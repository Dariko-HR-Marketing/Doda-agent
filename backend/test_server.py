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
        from backend import server
        os.environ["DODA_PASSWORD_HASH"] = server.password_hash("test password")
        cls.server = server

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.client_context = TestClient(self.server.app, base_url="https://doda.tajriba24.uz")
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    def login(self):
        self.assertEqual(self.client.post("/api/login", json={"password": "test password"}).status_code, 200)

    def test_private_data_and_origin(self):
        self.assertEqual(self.client.get("/api/state").status_code, 401)
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
            other.post("/api/login", json={"password": "test password"})
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
            self.assertTrue(all(status["configured"].values()))
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


if __name__ == "__main__":
    unittest.main()
