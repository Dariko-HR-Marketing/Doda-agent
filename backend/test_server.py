"""Integration checks for the private data boundary and durable task lifecycle."""

import base64
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

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


if __name__ == "__main__":
    unittest.main()
