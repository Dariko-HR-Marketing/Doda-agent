"""Integration checks for the private data boundary and durable task lifecycle."""

import base64
import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx

from fastapi.testclient import TestClient


class DodaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        os.environ["DODA_DB_PATH"] = str(Path(cls.temp.name) / "db.sqlite3")
        os.environ["DODA_FILES_PATH"] = str(Path(cls.temp.name) / "files")
        os.environ["DODA_SESSION_SECRET"] = "a-unique-test-session-secret-long-enough"
        os.environ["DODA_OWNER_EMAIL"] = "owner@example.com"
        os.environ["DODA_OWNER_NAME"] = "Kapitan"
        os.environ["DODA_ORG_NAME"] = "DARIKO"
        os.environ["DODA_SMTP_HOST"] = "smtp.example.com"
        os.environ["DODA_SMTP_FROM"] = "doda@example.com"
        from backend import server
        cls.server = server

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.server.attempts.clear()
        self.client_context = TestClient(self.server.app, base_url="https://doda.tajriba24.uz")
        self.client = self.client_context.__enter__()
        with self.server.db() as con:
            con.execute("DELETE FROM login_codes")

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    def login(self, client=None, email="owner@example.com"):
        client = client or self.client
        with patch.object(self.server, "send_login_code") as sender:
            self.assertEqual(client.post("/api/auth/request", json={"email": email}).status_code, 200)
        code = sender.call_args.args[1]
        self.assertEqual(client.post("/api/auth/verify", json={"email": email, "code": code}).status_code, 200)

    def test_private_data_and_origin(self):
        self.assertEqual(self.client.get("/api/state").status_code, 401)
        self.assertEqual(self.client.get("/api/ai/models").status_code, 401)
        self.login()
        self.assertEqual(self.client.post("/api/tasks", json={}, headers={"Origin": "https://attacker.example"}).status_code, 403)
        self.assertEqual(self.client.get("/api/state").status_code, 200)
        self.client.post("/api/logout")
        self.assertEqual(self.client.get("/api/state").status_code, 401)

    def test_task_file_and_approval_survive_new_session(self):
        self.login()
        upload = self.client.post("/api/files", json={"name": "brief.txt", "data": base64.b64encode(b"private brief").decode()})
        self.assertEqual(upload.status_code, 200)
        file_id = upload.json()["id"]
        payload = {"title": "Audit", "project": "DARIKO", "agent": "Hujjat va sifat agenti",
                   "result": "Xulosa", "deadline": "Ertaga", "files": [{"id": file_id}]}
        task = self.client.post("/api/tasks", json=payload)
        self.assertEqual(task.status_code, 200)
        task_id = task.json()["id"]
        self.assertEqual(self.client.get(f"/api/files/{file_id}").content, b"private brief")
        self.assertEqual(self.client.post(f"/api/tasks/{task_id}/action", json={"action": "approve"}).status_code, 409)
        for _ in range(4):
            self.assertEqual(self.client.post(f"/api/tasks/{task_id}/action", json={"action": "advance"}).status_code, 200)
        self.client.post(f"/api/tasks/{task_id}/action", json={"action": "evidence", "evidence": "Tekshirildi"})
        self.assertTrue(self.client.post(f"/api/tasks/{task_id}/action", json={"action": "approve"}).json()["approved"])
        with TestClient(self.server.app, base_url="https://doda.tajriba24.uz") as other:
            self.assertEqual(other.get(f"/api/files/{file_id}").status_code, 401)
            self.login(other)
            self.assertEqual(other.get("/api/state").json()["tasks"][0]["id"], task_id)

    def test_failed_model_response_does_not_create_fake_answer(self):
        self.login()
        with patch.object(self.server, "ask_model", new=AsyncMock(side_effect=self.server.HTTPException(503, "AI ulanmagan"))):
            self.assertEqual(self.client.post("/api/chat", json={"text": "Salom"}).status_code, 503)
        before = len(self.client.get("/api/state").json()["messages"])
        with patch.object(self.server, "ask_model", new=AsyncMock(return_value="Salom, Kapitan")):
            self.assertEqual(self.client.post("/api/chat", json={"text": "Salom"}).json()["reply"], "Salom, Kapitan")
        self.assertEqual(len(self.client.get("/api/state").json()["messages"]), before + 2)

    def test_agent_result_requires_captain_approval(self):
        self.login()
        payload = {"title": "Audit", "project": "DARIKO", "agent": "Hujjat va sifat agenti",
                   "result": "Xatolar jadvali", "deadline": "Ertaga", "files": []}
        task_id = self.client.post("/api/tasks", json=payload).json()["id"]
        with patch.object(self.server, "ask_model", new=AsyncMock(return_value="Tahlil natijasi")) as model:
            result = self.client.post(f"/api/tasks/{task_id}/run")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(model.await_args.args[1][0]["content"][0]["type"], "input_text")
        task = result.json()
        self.assertEqual(task["step"], 4)
        self.assertFalse(task["approved"])
        self.assertEqual(self.client.get(f"/api/files/{task['files'][0]['id']}").text, "Tahlil natijasi")
        self.assertEqual(self.client.post(f"/api/tasks/{task_id}/run").status_code, 409)

    def test_legacy_import_keeps_state_and_rejects_partial_batch(self):
        self.login()
        uploaded = self.client.post("/api/files", json={"name": "old.txt", "data": base64.b64encode(b"old file").decode()}).json()
        legacy = {"id": "t123456789", "title": "Oldingi ish", "project": "DARIKO",
                  "agent": "Hujjat va sifat agenti", "result": "Hisobot", "deadline": "Ertaga",
                  "step": 4, "evidence": "Tekshirildi", "approved": True,
                  "files": [uploaded], "events": [{"at": "old", "text": "Bajarildi"}]}
        broken = {**legacy, "id": "t999999999", "files": [{"id": "missing"}]}
        self.assertEqual(self.client.post("/api/import", json={"tasks": [broken, legacy]}).status_code, 400)
        self.assertFalse(any(t["id"] == legacy["id"] for t in self.client.get("/api/state").json()["tasks"]))
        result = self.client.post("/api/import", json={"tasks": [legacy]})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["imported"], [legacy["id"]])
        self.assertEqual(self.client.post("/api/import", json={"tasks": [legacy]}).json()["skipped"], [legacy["id"]])
        task = next(t for t in self.client.get("/api/state").json()["tasks"] if t["id"] == legacy["id"])
        self.assertTrue(task["approved"])
        self.assertEqual(task["step"], 4)
        self.assertEqual(self.client.get(f"/api/files/{uploaded['id']}").content, b"old file")

    def test_openai_first_then_gemini_on_temporary_failure(self):
        self.login()
        seen = []

        def reply(request):
            seen.append((request.url.host, json.loads(request.content), dict(request.headers)))
            if request.url.host == "api.openai.com":
                return httpx.Response(503, json={"error": "temporary"})
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "Gemini javobi"}]}}]})

        original_client = httpx.AsyncClient
        with patch.dict(os.environ, {"OPENAI_API_KEY": "private-openai", "DODA_MODEL": "example-openai",
                                  "GEMINI_API_KEY": "private-gemini", "DODA_GEMINI_MODEL": "example-gemini",
                                  "DODA_AI_ORDER": "openai,gemini"}), \
             patch.object(self.server.httpx, "AsyncClient", side_effect=lambda **kw: original_client(
                 transport=httpx.MockTransport(reply), **kw)):
            status = self.client.get("/api/ai/status").json()
            self.assertEqual(status["order"], ["openai", "gemini"])
            self.assertTrue(status["configured"]["openai"] and status["configured"]["gemini"])
            response = self.client.post("/api/chat", json={"text": "Salom"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], "Gemini javobi")
        self.assertEqual([item[0] for item in seen], ["api.openai.com", "generativelanguage.googleapis.com"])
        self.assertEqual(seen[0][1]["input"][-1]["content"], "Salom")
        self.assertEqual(seen[1][1]["contents"][-1]["parts"], [{"text": "Salom"}])
        self.assertEqual(seen[1][1]["systemInstruction"]["parts"][0]["text"][:8], "Sen DODA")
        self.assertEqual(seen[1][2]["x-goog-api-key"], "private-gemini")

    def test_gemini_primary_pdf_and_no_fake_reply_on_failure(self):
        requests = []

        def reply(request):
            requests.append(json.loads(request.content))
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "PDF xulosasi"}]}}]})

        original_client = httpx.AsyncClient
        with patch.dict(os.environ, {"GEMINI_API_KEY": "private-gemini", "DODA_GEMINI_MODEL": "example-gemini",
                                  "DODA_AI_ORDER": "gemini"}), \
             patch.object(self.server.httpx, "AsyncClient", side_effect=lambda **kw: original_client(
                 transport=httpx.MockTransport(reply), **kw)):
            answer = asyncio.run(self.server.ask_model("Tekshir", [{"role": "user", "content": [
                {"type": "input_text", "text": "Tahlil"}, {"type": "input_file", "filename": "brief.pdf",
                 "file_data": "data:application/pdf;base64," + base64.b64encode(b"%PDF-test").decode()}]}]))
            self.assertEqual(answer, "PDF xulosasi")
            self.assertEqual(requests[0]["contents"][0]["parts"][1]["inlineData"]["mimeType"], "application/pdf")
            with self.assertRaises(self.server.HTTPException) as context:
                asyncio.run(self.server.ask_model("Tekshir", [{"role": "user", "content": [
                    {"type": "input_file", "filename": "brief.docx", "file_data": "data:application/zip;base64,YQ=="}]}]))
            self.assertEqual(context.exception.status_code, 415)

        self.login()
        original_client = httpx.AsyncClient
        with patch.dict(os.environ, {"DODA_AI_ORDER": "gemini", "GEMINI_API_KEY": "private-gemini",
                                  "DODA_GEMINI_MODEL": "example-gemini"}), \
             patch.object(self.server.httpx, "AsyncClient", side_effect=lambda **kw: original_client(
                 transport=httpx.MockTransport(lambda _: httpx.Response(503)), **kw)):
            before = len(self.client.get("/api/state").json()["messages"])
            self.assertEqual(self.client.post("/api/chat", json={"text": "Xato sinovi"}).status_code, 502)
            self.assertEqual(len(self.client.get("/api/state").json()["messages"]), before)

    def test_claude_message_and_pdf_adapter(self):
        seen = []

        def reply(request):
            seen.append((request.url.path, dict(request.headers), json.loads(request.content)))
            return httpx.Response(200, json={"content": [{"type": "thinking", "thinking": "internal"},
                                                          {"type": "text", "text": "Claude xulosasi"}]})

        original_client = httpx.AsyncClient
        with patch.dict(os.environ, {"DODA_AI_ORDER": "claude", "ANTHROPIC_API_KEY": "private-claude",
                                  "DODA_CLAUDE_MODEL": "example-claude", "ANTHROPIC_WORKSPACE_ID": "wrkspc_test"}), \
             patch.object(self.server.httpx, "AsyncClient", side_effect=lambda **kw: original_client(
                 transport=httpx.MockTransport(reply), **kw)):
            answer = asyncio.run(self.server.ask_model("Tekshir", [{"role": "user", "content": [
                {"type": "input_text", "text": "Tahlil"}, {"type": "input_file", "filename": "brief.pdf",
                 "file_data": "data:application/pdf;base64," + base64.b64encode(b"%PDF-test").decode()}]}]))
        self.assertEqual(answer, "Claude xulosasi")
        self.assertEqual(seen[0][0], "/v1/messages")
        self.assertEqual(seen[0][1]["anthropic-version"], "2026-10-21")
        self.assertEqual(seen[0][1]["anthropic-workspace-id"], "wrkspc_test")
        self.assertEqual(seen[0][2]["messages"][0]["content"][1]["type"], "document")

    def test_model_catalog_and_explicit_selection(self):
        self.login()
        self.server.MODEL_CATALOG.clear()
        seen = []

        def reply(request):
            seen.append((request.method, request.url.path, json.loads(request.content) if request.content else None))
            if request.url.host == "api.openai.com" and request.url.path == "/v1/models":
                return httpx.Response(200, json={"data": [{"id": "gpt-example", "object": "model"}]})
            if request.url.path == "/v1beta/models":
                return httpx.Response(200, json={"models": [{"name": "models/gemini-example",
                                                             "supportedGenerationMethods": ["generateContent"]}]})
            if request.url.path == "/v1/responses":
                return httpx.Response(200, json={"output": [{"content": [{"type": "output_text", "text": "Tanlangan model"}]}]})
            return httpx.Response(200, json={"data": [{"id": "claude-example", "lifecycle": "active"}], "has_more": False})

        original_client = httpx.AsyncClient
        with patch.dict(os.environ, {"OPENAI_API_KEY": "key-a", "DODA_MODEL": "gpt-example",
                                  "GEMINI_API_KEY": "key-g", "DODA_GEMINI_MODEL": "gemini-example",
                                  "ANTHROPIC_API_KEY": "key-c", "DODA_CLAUDE_MODEL": "claude-example"}), \
             patch.object(self.server.httpx, "AsyncClient", side_effect=lambda **kw: original_client(
                 transport=httpx.MockTransport(reply), **kw)):
            catalog = self.client.get("/api/ai/models").json()
            self.assertEqual(set(catalog["models"]), {"openai", "gemini", "claude"})
            self.assertEqual(catalog["models"]["gemini"][0]["id"], "gemini-example")
            answer = self.client.post("/api/chat", json={"text": "Salom", "provider": "openai", "model": "gpt-example"})
            self.assertEqual(answer.json()["reply"], "Tanlangan model")
            self.assertEqual(self.client.post("/api/chat", json={"text": "Salom", "provider": "openai",
                                                               "model": "unlisted"}).status_code, 400)
        self.assertEqual(len([item for item in seen if item[1] == "/v1/responses"]), 1)

    def test_email_verification_and_organization_access(self):
        with patch.object(self.server, "send_login_code") as sender:
            unknown = self.client.post("/api/auth/request", json={"email": "unknown@example.com"})
            self.assertEqual(unknown.status_code, 200)
            sender.assert_not_called()
            valid = self.client.post("/api/auth/request", json={"email": "owner@example.com"})
            self.assertEqual(valid.json()["message"], unknown.json()["message"])
        code = sender.call_args.args[1]
        wrong = "00000000" if code != "00000000" else "11111111"
        for _ in range(5):
            self.assertEqual(self.client.post("/api/auth/verify", json={"email": "owner@example.com", "code": wrong}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/verify", json={"email": "owner@example.com", "code": code}).status_code, 401)

    def test_expired_code_and_mail_failure_do_not_open_session(self):
        with patch.object(self.server, "send_login_code") as sender:
            self.assertEqual(self.client.post("/api/auth/request", json={"email": "owner@example.com"}).status_code, 200)
        code = sender.call_args.args[1]
        with self.server.db() as con:
            con.execute("UPDATE login_codes SET expires_at=0 WHERE email=?", ("owner@example.com",))
        self.assertEqual(self.client.post("/api/auth/verify", json={"email": "owner@example.com", "code": code}).status_code, 401)
        with self.server.db() as con:
            con.execute("DELETE FROM login_codes WHERE email=?", ("owner@example.com",))
        with patch.object(self.server, "send_login_code", side_effect=self.server.HTTPException(503, "Pochta ishlamadi")):
            self.assertEqual(self.client.post("/api/auth/request", json={"email": "owner@example.com"}).status_code, 503)
        with self.server.db() as con:
            self.assertIsNone(con.execute("SELECT 1 FROM login_codes WHERE email=?", ("owner@example.com",)).fetchone())
        self.assertEqual(self.client.get("/api/me").status_code, 401)
        with self.server.db() as con:
            con.execute("DELETE FROM login_codes WHERE email=?", ("owner@example.com",))
        self.login()
        profile = self.client.get("/api/me").json()
        self.assertEqual(profile["organization"], "DARIKO")
        self.assertEqual(profile["email"], "owner@example.com")
        self.assertTrue(profile["verified"])
        self.assertEqual(self.client.post("/api/me", json={"name": "Hikmatullo"}).status_code, 200)
        self.assertEqual(self.client.post("/api/members", json={"email": "staff@example.com", "name": "Xodim"}).status_code, 200)
        with TestClient(self.server.app, base_url="https://doda.tajriba24.uz") as staff:
            self.login(staff, "staff@example.com")
            self.assertEqual(staff.get("/api/me").json()["role"], "member")
            self.assertEqual(staff.get("/api/members").status_code, 403)
            task_id = self.client.post("/api/tasks", json={"title": "Sinov", "project": "DARIKO",
                "agent": "Hujjat va sifat agenti", "result": "Xulosa", "deadline": "Ertaga", "files": []}).json()["id"]
            self.assertEqual(staff.post(f"/api/tasks/{task_id}/action", json={"action": "approve"}).status_code, 403)
            self.assertEqual(staff.post("/api/import", json={"tasks": [{"id": "tvalid123", "title": "Sinov",
                "project": "DARIKO", "agent": "Hujjat va sifat agenti", "result": "Xulosa",
                "deadline": "Ertaga", "step": 0, "files": []}]}).status_code, 403)
            self.assertEqual(staff.post("/api/logout").status_code, 200)
            self.assertEqual(staff.get("/api/me").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/verify", json={"email": "owner@example.com", "code": code}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
