"""Single-user DODA API. Run behind the existing HTTPS reverse proxy."""

import base64
import binascii
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import smtplib
import ssl
import sqlite3
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


DB_PATH = Path(os.getenv("DODA_DB_PATH", "/data/doda.sqlite3"))
FILES_PATH = Path(os.getenv("DODA_FILES_PATH", "/data/files"))
ORIGIN = os.getenv("DODA_PUBLIC_ORIGIN", "https://doda.tajriba24.uz").rstrip("/")
COOKIE = "__Host-doda_session"
SESSION_SECONDS = 7 * 24 * 3600
CODE_SECONDS = 10 * 60
MAX_FILE = 20 * 1024 * 1024
ALLOWED_AGENTS = ("Hujjat va sifat agenti", "HR jarayonlari agenti", "Marketing va tadqiqot agenti")
SUPPORTED_FILES = {".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".xlsx", ".pptx"}
attempts = defaultdict(deque)
MODEL_CATALOG = {}
PROVIDERS = ("openai", "gemini", "claude")


def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def init():
    FILES_PATH.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL,
          content TEXT NOT NULL, created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, size INTEGER NOT NULL,
          task_id TEXT REFERENCES tasks(id), created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS members (
          email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
          verified_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS login_codes (
          email TEXT PRIMARY KEY, code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL, sent_at INTEGER NOT NULL, attempts INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES members(email),
          expires_at INTEGER NOT NULL
        );
        """)
        owner = os.getenv("DODA_OWNER_EMAIL", "").strip().lower()
        if owner:
            con.execute("INSERT OR IGNORE INTO members(email,name,role) VALUES (?,?,?)",
                        (owner, os.getenv("DODA_OWNER_NAME", "Kapitan"), "owner"))


@asynccontextmanager
async def lifespan(_app):
    init()
    yield


app = FastAPI(title="DODA", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


def secret_key():
    key = os.getenv("DODA_SESSION_SECRET", "")
    if len(key) < 32:
        raise HTTPException(503, "Session secret sozlanmagan")
    return key.encode()


def authenticated(request: Request):
    token = request.cookies.get(COOKIE, "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{40,100}", token):
        raise HTTPException(401, "Kirish talab qilinadi")
    digest = hashlib.sha256(token.encode()).hexdigest()
    with db() as con:
        row = con.execute("SELECT m.email,m.name,m.role,m.verified_at,s.expires_at FROM sessions s "
                          "JOIN members m ON m.email=s.email WHERE s.token_hash=?", (digest,)).fetchone()
    if not row or not row["verified_at"] or row["expires_at"] <= time.time():
        raise HTTPException(401, "Kirish talab qilinadi")
    return dict(row)


@app.middleware("http")
async def same_origin(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        fetch_site = request.headers.get("sec-fetch-site")
        if (origin and origin != ORIGIN) or fetch_site == "cross-site":
            return Response(status_code=403)
    return await call_next(request)


class EmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


def normalized_email(email):
    value = email.strip().lower()
    if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", value):
        raise HTTPException(400, "Elektron pochta manzili noto‘g‘ri")
    return value


def send_login_code(email, code):
    host = os.getenv("DODA_SMTP_HOST")
    sender = os.getenv("DODA_SMTP_FROM")
    mode = os.getenv("DODA_SMTP_SECURITY", "starttls")
    if not host or not sender or mode not in ("starttls", "ssl"):
        raise HTTPException(503, "Pochta xizmati sozlanmagan")
    try:
        port = int(os.getenv("DODA_SMTP_PORT", "465" if mode == "ssl" else "587"))
    except ValueError:
        raise HTTPException(503, "Pochta porti noto‘g‘ri sozlangan")
    message = EmailMessage()
    message["From"] = sender
    message["To"] = email
    message["Subject"] = "DODA kirish kodi"
    message.set_content(f"DODA kirish kodingiz: {code}\nKod 10 daqiqada tugaydi. Uni hech kimga bermang.")
    try:
        client = (smtplib.SMTP_SSL(host, port, timeout=15, context=ssl.create_default_context())
                  if mode == "ssl" else smtplib.SMTP(host, port, timeout=15))
        with client as smtp:
            if mode == "starttls":
                smtp.starttls(context=ssl.create_default_context())
            if os.getenv("DODA_SMTP_USER"):
                smtp.login(os.environ["DODA_SMTP_USER"], os.environ["DODA_SMTP_PASSWORD"])
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException, KeyError, ValueError):
        raise HTTPException(503, "Pochta xizmati vaqtincha ishlamayapti")


@app.post("/api/auth/request")
def request_code(body: EmailRequest, request: Request):
    email = normalized_email(body.email)
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    bucket = attempts[ip]
    while bucket and bucket[0] < now - 900:
        bucket.popleft()
    if len(bucket) >= 8:
        raise HTTPException(429, "Ko‘p urinish. 15 daqiqadan keyin qayta sinang")
    bucket.append(now)
    if not os.getenv("DODA_SMTP_HOST") or not os.getenv("DODA_SMTP_FROM") or not os.getenv("DODA_OWNER_EMAIL"):
        raise HTTPException(503, "Pochta va tashkilot egasi sozlanmagan")
    with db() as con:
        member = con.execute("SELECT email FROM members WHERE email=?", (email,)).fetchone()
        previous = con.execute("SELECT sent_at FROM login_codes WHERE email=?", (email,)).fetchone()
        if member and previous and previous["sent_at"] > time.time() - 60:
            return {"message": "Agar manzilga ruxsat berilgan bo‘lsa, kirish kodi yuborildi"}
    if member:
        code = f"{secrets.randbelow(100000000):08d}"
        digest = hmac.new(secret_key(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()
        with db() as con:
            con.execute("INSERT OR REPLACE INTO login_codes VALUES (?,?,?,?,?)",
                        (email, digest, int(time.time()) + CODE_SECONDS, int(time.time()), 0))
        try:
            send_login_code(email, code)
        except HTTPException:
            with db() as con:
                con.execute("DELETE FROM login_codes WHERE email=? AND code_hash=?", (email, digest))
            raise
    return {"message": "Agar manzilga ruxsat berilgan bo‘lsa, kirish kodi yuborildi"}


class VerifyCode(EmailRequest):
    code: str = Field(pattern=r"^[0-9]{8}$")


@app.post("/api/auth/verify")
def verify_code(body: VerifyCode, response: Response):
    email = normalized_email(body.email)
    digest = hmac.new(secret_key(), f"{email}:{body.code}".encode(), hashlib.sha256).hexdigest()
    with db() as con:
        row = con.execute("SELECT code_hash,expires_at,attempts FROM login_codes WHERE email=?", (email,)).fetchone()
        if not row or row["expires_at"] <= time.time() or row["attempts"] >= 5:
            raise HTTPException(401, "Kod noto‘g‘ri yoki muddati tugagan")
        if not hmac.compare_digest(digest, row["code_hash"]):
            con.execute("UPDATE login_codes SET attempts=attempts+1 WHERE email=?", (email,))
            con.commit()
            raise HTTPException(401, "Kod noto‘g‘ri yoki muddati tugagan")
        con.execute("DELETE FROM login_codes WHERE email=?", (email,))
        con.execute("UPDATE members SET verified_at=? WHERE email=?", (int(time.time()), email))
        token = secrets.token_urlsafe(48)
        con.execute("INSERT INTO sessions VALUES (?,?,?)",
                    (hashlib.sha256(token.encode()).hexdigest(), email, int(time.time()) + SESSION_SECONDS))
    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS,
                        secure=True, httponly=True, samesite="strict", path="/")
    return {"ok": True}


@app.get("/api/session")
def session(member=Depends(authenticated)):
    return {"ok": True, "email": member["email"]}


@app.post("/api/logout")
def logout(request: Request, response: Response, _=Depends(authenticated)):
    with db() as con:
        con.execute("DELETE FROM sessions WHERE token_hash=?",
                    (hashlib.sha256(request.cookies[COOKIE].encode()).hexdigest(),))
    response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="strict")
    return {"ok": True}


@app.get("/api/me")
def me(member=Depends(authenticated)):
    return {"email": member["email"], "name": member["name"], "role": member["role"],
            "verified": bool(member["verified_at"]), "organization": os.getenv("DODA_ORG_NAME", "DODA tashkiloti")}


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=80)


@app.post("/api/me")
def update_me(body: ProfileUpdate, member=Depends(authenticated)):
    if len(body.name.strip()) < 2:
        raise HTTPException(400, "Ism kamida 2 belgidan iborat bo‘lsin")
    with db() as con:
        con.execute("UPDATE members SET name=? WHERE email=?", (body.name.strip(), member["email"]))
    return {"ok": True}


@app.get("/api/members")
def members(member=Depends(authenticated)):
    if member["role"] != "owner":
        raise HTTPException(403, "Faqat tashkilot egasi")
    with db() as con:
        return {"members": [dict(row) for row in con.execute("SELECT email,name,role,verified_at FROM members ORDER BY email")]}


class InviteMember(EmailRequest):
    name: str = Field(min_length=2, max_length=80)


@app.post("/api/members")
def invite_member(body: InviteMember, member=Depends(authenticated)):
    if member["role"] != "owner":
        raise HTTPException(403, "Faqat tashkilot egasi")
    email = normalized_email(body.email)
    if len(body.name.strip()) < 2:
        raise HTTPException(400, "Ism kamida 2 belgidan iborat bo‘lsin")
    with db() as con:
        if con.execute("SELECT 1 FROM members WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "Bu manzil allaqachon qo‘shilgan")
        con.execute("INSERT INTO members(email,name,role) VALUES (?,?,?)", (email, body.name.strip(), "member"))
    return {"ok": True}


@app.get("/api/state")
def state(_=Depends(authenticated)):
    with db() as con:
        tasks = [json.loads(row["data"]) for row in con.execute("SELECT data FROM tasks ORDER BY created_at DESC, rowid DESC")]
        messages = [dict(row) for row in con.execute(
            "SELECT role,content,created_at FROM messages ORDER BY id DESC LIMIT 100")]
    return {"tasks": tasks, "messages": messages[::-1]}


class Task(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    project: str = Field(min_length=1, max_length=120)
    agent: str
    result: str = Field(min_length=1, max_length=2000)
    deadline: str = Field(min_length=1, max_length=80)
    files: list[dict] = Field(default_factory=list, max_length=20)


class LegacyTask(Task):
    id: str = Field(min_length=2, max_length=80)
    step: int = Field(ge=0, le=4)
    evidence: str = Field(default="", max_length=5000)
    approved: bool = False
    events: list[dict] = Field(default_factory=list, max_length=100)


class LegacyImport(BaseModel):
    tasks: list[LegacyTask] = Field(min_length=1, max_length=200)


@app.post("/api/import")
def import_legacy(body: LegacyImport, member=Depends(authenticated)):
    """Import existing same-origin browser tasks after their file blobs were uploaded."""
    if member["role"] != "owner":
        raise HTTPException(403, "Faqat tashkilot egasi")
    ids = [task.id for task in body.tasks]
    if len(ids) != len(set(ids)) or any(not re.fullmatch(r"[A-Za-z0-9_-]{2,80}", task_id) or task_id == "sample" for task_id in ids):
        raise HTTPException(400, "Topshiriq identifikatorlari noto‘g‘ri")
    imported, skipped = [], []
    with db() as con:
        for source in reversed(body.tasks):
            if con.execute("SELECT 1 FROM tasks WHERE id=?", (source.id,)).fetchone():
                skipped.append(source.id)
                continue
            if source.agent not in ALLOWED_AGENTS or (source.approved and (source.step != 4 or not source.evidence)):
                raise HTTPException(400, "Topshiriq holati yoki agenti noto‘g‘ri")
            file_ids = [str(f.get("id", "")) for f in source.files]
            if len(file_ids) != len(set(file_ids)):
                raise HTTPException(400, "Fayl takrorlangan")
            files = []
            if file_ids:
                rows = con.execute(f"SELECT id,name FROM files WHERE task_id IS NULL AND id IN ({','.join('?' for _ in file_ids)})", file_ids).fetchall()
                if len(rows) != len(file_ids):
                    raise HTTPException(400, "Ko‘chiriladigan fayl topilmadi")
                files = [dict(row) for row in rows]
            task = source.model_dump(exclude={"files"})
            task["sample"] = False
            task["files"] = files
            task["events"] = [{"at": str(e.get("at", ""))[:80], "text": str(e.get("text", ""))[:500]}
                              for e in source.events]
            task["events"].append({"at": time.strftime("%Y-%m-%d %H:%M"), "text": "Brauzerdan serverga ko‘chirildi"})
            con.execute("INSERT INTO tasks VALUES (?,?,?)", (source.id, json.dumps(task, ensure_ascii=False), int(time.time())))
            for file_id in file_ids:
                con.execute("UPDATE files SET task_id=? WHERE id=?", (source.id, file_id))
            imported.append(source.id)
    return {"imported": imported, "skipped": skipped}


@app.post("/api/tasks")
def create_task(body: Task, _=Depends(authenticated)):
    if body.agent not in ALLOWED_AGENTS:
        raise HTTPException(400, "Noma’lum agent")
    task_id = uuid.uuid4().hex
    file_ids = [str(f.get("id", "")) for f in body.files]
    if len(file_ids) != len(set(file_ids)):
        raise HTTPException(400, "Fayl takrorlangan")
    now = int(time.time())
    task = {**body.model_dump(exclude={"files"}), "id": task_id, "files": [], "step": 0,
            "evidence": "", "approved": False, "sample": False,
            "events": [{"at": time.strftime("%Y-%m-%d %H:%M"), "text": "Topshiriq pasporti yaratildi"}]}
    with db() as con:
        if file_ids:
            found = con.execute(f"SELECT id,name FROM files WHERE task_id IS NULL AND id IN ({','.join('?' for _ in file_ids)})", file_ids).fetchall()
            if len(found) != len(file_ids):
                raise HTTPException(400, "Fayl topilmadi yoki biriktirilgan")
            task["files"] = [dict(f) for f in found]
        con.execute("INSERT INTO tasks VALUES (?,?,?)", (task_id, json.dumps(task, ensure_ascii=False), now))
        for file_id in file_ids:
            con.execute("UPDATE files SET task_id=? WHERE id=?", (task_id, file_id))
    return task


class TaskAction(BaseModel):
    action: str
    evidence: str = Field(default="", max_length=5000)


@app.post("/api/tasks/{task_id}/action")
def task_action(task_id: str, body: TaskAction, member=Depends(authenticated)):
    if body.action == "approve" and member["role"] != "owner":
        raise HTTPException(403, "Yakuniy qabul faqat tashkilot egasiga tegishli")
    with db() as con:
        row = con.execute("SELECT data FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Topshiriq topilmadi")
        task = json.loads(row["data"])
        if body.action == "advance" and task["step"] < 4 and not task["approved"]:
            task["step"] += 1
            event = "Bosqich qo‘lda o‘zgartirildi"
        elif body.action == "evidence" and task["step"] == 4 and body.evidence.strip() and not task["approved"]:
            task["evidence"] = body.evidence.strip()
            event = "Dalil qayd etildi"
        elif body.action == "approve" and task["step"] == 4 and task["evidence"] and not task["approved"]:
            task["approved"] = True
            event = "Kapitan qabul qildi"
        else:
            raise HTTPException(409, "Bu bosqichda amal mumkin emas")
        task["events"].append({"at": time.strftime("%Y-%m-%d %H:%M"), "text": event})
        con.execute("UPDATE tasks SET data=? WHERE id=?", (json.dumps(task, ensure_ascii=False), task_id))
    return task


class FileUpload(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    data: str = Field(max_length=28 * 1024 * 1024)


@app.post("/api/files")
def upload(body: FileUpload, _=Depends(authenticated)):
    try:
        content = base64.b64decode(body.data, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Fayl formati xato")
    if len(content) > MAX_FILE:
        raise HTTPException(413, "Fayl 20 MB dan katta")
    file_id = uuid.uuid4().hex
    name = Path(body.name.replace("\\", "/")).name
    target = FILES_PATH / file_id
    with target.open("xb") as f:
        f.write(content)
    with db() as con:
        con.execute("INSERT INTO files VALUES (?,?,?,?,?)", (file_id, name, len(content), None, int(time.time())))
    return {"id": file_id, "name": name}


@app.get("/api/files/{file_id}")
def download(file_id: str, _=Depends(authenticated)):
    with db() as con:
        row = con.execute("SELECT name FROM files WHERE id=? AND task_id IS NOT NULL", (file_id,)).fetchone()
    if not row or not (FILES_PATH / file_id).is_file():
        raise HTTPException(404, "Fayl topilmadi")
    return FileResponse(FILES_PATH / file_id, filename=row["name"], media_type="application/octet-stream",
                        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


class ChatInput(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    provider: str | None = None
    model: str | None = None


def provider_order():
    order = [item.strip().lower() for item in os.getenv("DODA_AI_ORDER", "openai,gemini,claude").split(",")]
    if not order or len(order) != len(set(order)) or any(item not in PROVIDERS for item in order):
        raise HTTPException(503, "AI xizmatlari tartibi noto‘g‘ri sozlangan")
    return order


def provider_configured(provider):
    if provider == "openai":
        return bool(os.getenv("OPENAI_API_KEY") and os.getenv("DODA_MODEL"))
    if provider == "gemini":
        return bool(os.getenv("GEMINI_API_KEY") and os.getenv("DODA_GEMINI_MODEL"))
    return bool(os.getenv("ANTHROPIC_API_KEY") and os.getenv("DODA_CLAUDE_MODEL"))


@app.get("/api/ai/status")
def ai_status(_=Depends(authenticated)):
    return {"order": provider_order(), "configured": {name: provider_configured(name)
            for name in PROVIDERS}}


def claude_headers():
    headers = {"Authorization": f"Bearer {os.environ['ANTHROPIC_API_KEY']}",
               "anthropic-version": "2026-10-21"}
    if os.getenv("ANTHROPIC_WORKSPACE_ID"):
        headers["anthropic-workspace-id"] = os.environ["ANTHROPIC_WORKSPACE_ID"]
    return headers


async def list_models(provider):
    if provider not in PROVIDERS or not provider_configured(provider):
        raise HTTPException(503, "AI xizmati sozlanmagan")
    cached = MODEL_CATALOG.get(provider)
    if cached and time.time() - cached[0] < 600:
        return cached[1]
    if provider == "openai":
        url, headers = "https://api.openai.com/v1/models", {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"}
    elif provider == "gemini":
        url, headers = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {"x-goog-api-key": os.environ["GEMINI_API_KEY"]}
    else:
        url, headers = "https://api.anthropic.com/v1/models?limit=1000", claude_headers()
    models, page = [], None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            for _ in range(10):
                target = url + (f"&pageToken={quote(page, safe='')}" if provider == "gemini" and page else
                                f"&after_id={quote(page, safe='')}" if provider == "claude" and page else "")
                response = await client.get(target, headers=headers)
                response.raise_for_status()
                data = response.json()
                if provider == "gemini":
                    models.extend({"id": row["name"].removeprefix("models/"), "label": row.get("displayName", row["name"])}
                                  for row in data.get("models", []) if "generateContent" in row.get("supportedGenerationMethods", []))
                    page = data.get("nextPageToken")
                else:
                    models.extend({"id": row["id"], "label": row.get("display_name", row["id"])}
                                  for row in data.get("data", []) if provider != "claude" or row.get("lifecycle") != "retired")
                    page = data.get("last_id") if provider == "claude" and data.get("has_more") else None
                if not page:
                    break
        if page:
            raise ValueError("Model ro‘yxati chegaradan oshdi")
        MODEL_CATALOG[provider] = (time.time(), models)
        return models
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(502, f"{provider} model ro‘yxati olinmadi")


@app.get("/api/ai/models")
async def ai_models(_=Depends(authenticated)):
    result = {"models": {}, "errors": {}}
    for provider in PROVIDERS:
        if provider_configured(provider):
            try:
                result["models"][provider] = await list_models(provider)
            except HTTPException:
                result["errors"][provider] = "Model ro‘yxati olinmadi"
    return result


def gemini_contents(history):
    converted = []
    for entry in history:
        parts = []
        contents = entry["content"] if isinstance(entry["content"], list) else [entry["content"]]
        for item in contents:
            if isinstance(item, str):
                parts.append({"text": item})
            elif item.get("type") == "input_text":
                parts.append({"text": item["text"]})
            elif item.get("type") == "input_file":
                name = item.get("filename", "")
                extension = Path(name).suffix.lower()
                if extension not in (".pdf", ".txt", ".md", ".csv"):
                    raise HTTPException(415, f"Gemini bu fayl turini qabul qilmaydi: {name}")
                mime, encoded = item["file_data"].split(";base64,", 1)
                if extension == ".pdf":
                    parts.append({"inlineData": {"mimeType": "application/pdf", "data": encoded}})
                else:
                    parts.append({"text": f"Fayl {name}:\n" + base64.b64decode(encoded).decode("utf-8-sig")})
            else:
                raise HTTPException(415, "Gemini uchun noma’lum kontent")
        converted.append({"role": "model" if entry["role"] == "assistant" else "user", "parts": parts})
    return converted


def claude_contents(history):
    messages = []
    for entry in history:
        blocks = []
        contents = entry["content"] if isinstance(entry["content"], list) else [entry["content"]]
        for item in contents:
            if isinstance(item, str):
                blocks.append({"type": "text", "text": item})
            elif item.get("type") == "input_text":
                blocks.append({"type": "text", "text": item["text"]})
            elif item.get("type") == "input_file":
                name = item.get("filename", "")
                extension = Path(name).suffix.lower()
                if extension not in (".pdf", ".txt", ".md", ".csv"):
                    raise HTTPException(415, f"Claude bu fayl turini qabul qilmaydi: {name}")
                _, encoded = item["file_data"].split(";base64,", 1)
                if extension == ".pdf":
                    blocks.append({"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": encoded}})
                else:
                    blocks.append({"type": "text", "text": f"Fayl {name}:\n" + base64.b64decode(encoded).decode("utf-8-sig")})
            else:
                raise HTTPException(415, "Claude uchun noma’lum kontent")
        messages.append({"role": entry["role"], "content": blocks})
    return messages


async def call_provider(provider, instructions, history, model=None):
    key = os.environ[{"openai": "OPENAI_API_KEY", "gemini": "GEMINI_API_KEY", "claude": "ANTHROPIC_API_KEY"}[provider]]
    model = model or os.environ[{"openai": "DODA_MODEL", "gemini": "DODA_GEMINI_MODEL", "claude": "DODA_CLAUDE_MODEL"}[provider]]
    pattern = r"[A-Za-z0-9_.-]{1,100}" if provider == "gemini" else r"[A-Za-z0-9_.:/-]{1,100}"
    if not re.fullmatch(pattern, model):
        raise HTTPException(503, f"{provider} model nomi noto‘g‘ri sozlangan")
    if provider == "openai":
        url = "https://api.openai.com/v1/responses"
        headers = {"Authorization": f"Bearer {key}"}
        payload = {"model": model, "instructions": instructions, "input": history,
                   "store": False, "max_output_tokens": 1500}
    elif provider == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {"x-goog-api-key": key}
        payload = {"systemInstruction": {"parts": [{"text": instructions}]},
                   "contents": gemini_contents(history), "generationConfig": {"maxOutputTokens": 1500}}
    else:
        url = "https://api.anthropic.com/v1/messages"
        headers = claude_headers()
        payload = {"model": model, "system": instructions, "messages": claude_contents(history), "max_tokens": 1500}
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code in (401, 403, 404):
                raise HTTPException(503, f"{provider} kaliti yoki modeli tekshirilishi kerak")
            if res.status_code == 400:
                raise HTTPException(503, f"{provider} so‘rov yoki model sozlamasini tekshirish kerak")
            res.raise_for_status()
            data = res.json()
        if provider == "openai":
            output = "\n".join(item.get("text", "") for entry in data.get("output", [])
                               for item in entry.get("content", []) if item.get("type") == "output_text").strip()
        elif provider == "gemini":
            output = "\n".join(part.get("text", "") for candidate in data.get("candidates", [])[:1]
                               for part in candidate.get("content", {}).get("parts", [])).strip()
        else:
            output = "\n".join(part.get("text", "") for part in data.get("content", []) if part.get("type") == "text").strip()
        if not output:
            raise ValueError("Bo‘sh javob")
        return output
    except (httpx.HTTPError, ValueError, UnicodeError, binascii.Error):
        raise HTTPException(502, f"{provider} vaqtincha javob bermadi")


async def ask_model(instructions: str, history: list[dict], provider=None, model=None):
    if bool(provider) != bool(model):
        raise HTTPException(400, "AI xizmati va model birga tanlanishi kerak")
    if provider and (provider not in PROVIDERS or not provider_configured(provider)):
        raise HTTPException(400, "Tanlangan AI xizmati sozlanmagan")
    pattern = r"[A-Za-z0-9_.-]{1,100}" if provider == "gemini" else r"[A-Za-z0-9_.:/-]{1,100}"
    if model and not re.fullmatch(pattern, model):
        raise HTTPException(400, "Model nomi noto‘g‘ri")
    if provider and model and model not in {row["id"] for row in await list_models(provider)}:
        raise HTTPException(400, "Tanlangan model ushbu hisobda topilmadi")
    available = [provider] if provider else [name for name in provider_order() if provider_configured(name)]
    if not available:
        raise HTTPException(503, "AI ulanishi hali sozlanmagan")
    has_office_file = any(isinstance(item, dict) and item.get("type") == "input_file" and
                          Path(item.get("filename", "")).suffix.lower() not in (".pdf", ".txt", ".md", ".csv")
                          for entry in history for item in (entry["content"] if isinstance(entry["content"], list) else []))
    if has_office_file:
        available = [name for name in available if name == "openai"]
        if not available:
            raise HTTPException(415, "Bu fayl turini tahlil qilish uchun OpenAI ulanishi kerak")
    last_failure = None
    for provider in available:
        try:
            return await call_provider(provider, instructions, history, model)
        except HTTPException as error:
            if error.status_code != 502 or model:
                raise
            last_failure = error
    raise last_failure


class ModelChoice(BaseModel):
    provider: str | None = None
    model: str | None = None


@app.post("/api/tasks/{task_id}/run")
async def run_task(task_id: str, choice: ModelChoice | None = None, _=Depends(authenticated)):
    choice = choice or ModelChoice()
    with db() as con:
        row = con.execute("SELECT data FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Topshiriq topilmadi")
        task = json.loads(row["data"])
        if task["approved"] or task["evidence"]:
            raise HTTPException(409, "Topshiriq allaqachon natijaga ega")
        files = [dict(f) for f in con.execute("SELECT id,name,size FROM files WHERE task_id=?", (task_id,))]
    if sum(f["size"] for f in files) > 40 * 1024 * 1024:
        raise HTTPException(413, "Birgalikdagi fayllar 40 MB dan oshmasin")
    content = [{"type": "input_text", "text":
                f"Loyiha: {task['project']}\nTopshiriq: {task['title']}\nKutilgan natija va qabul mezoni: {task['result']}\n"
                "Fayllar bo‘lsa, ularning mazmunini tekshir. Manbasiz yoki tekshirilmagan faktni aniq deb ko‘rsatma."}]
    for f in files:
        extension = Path(f["name"]).suffix.lower()
        if extension not in SUPPORTED_FILES:
            raise HTTPException(415, f"Bu turdagi faylni agent o‘qiy olmaydi: {f['name']}")
        mime = mimetypes.guess_type(f["name"])[0] or "text/plain"
        raw = (FILES_PATH / f["id"]).read_bytes()
        content.append({"type": "input_file", "filename": f["name"],
                        "file_data": f"data:{mime};base64,{base64.b64encode(raw).decode()}"})
    answer = await ask_model(
        f"Sen DODA ichidagi {task['agent']}san. Faqat topshiriq bo‘yicha yozma tahlil tayyorla. "
        "Tashqi amallarni bajarma, tasdiq berma, yakuniy qabulni Kapitanga qoldir. "
        "Agar ma’lumot yetishmasa, nima yetishmasligini aniq yoz. Javob O‘zbek tilida bo‘lsin.",
        [{"role": "user", "content": content}], choice.provider, choice.model)
    result_id = uuid.uuid4().hex
    filename = f"DODA-natija-{task_id[:8]}.txt"
    (FILES_PATH / result_id).write_text(answer, encoding="utf-8")
    with db() as con:
        current = con.execute("SELECT data FROM tasks WHERE id=?", (task_id,)).fetchone()
        task = json.loads(current["data"])
        if task["approved"] or task["evidence"]:
            (FILES_PATH / result_id).unlink(missing_ok=True)
            raise HTTPException(409, "Topshiriq boshqa jarayonda yakunlangan")
        task["step"] = 4
        task["evidence"] = "Agent yozma natija tayyorladi. Faylni tekshirib, qabul qilish yoki qayta ishlashga qaror qiling."
        task["files"].append({"id": result_id, "name": filename})
        task["events"].append({"at": time.strftime("%Y-%m-%d %H:%M"), "text": "Agent natijasi tayyorlandi; Kapitan tekshiruvida"})
        con.execute("INSERT INTO files VALUES (?,?,?,?,?)", (result_id, filename, len(answer.encode()), task_id, int(time.time())))
        con.execute("UPDATE tasks SET data=? WHERE id=?", (json.dumps(task, ensure_ascii=False), task_id))
    return task


@app.post("/api/chat")
async def chat(body: ChatInput, _=Depends(authenticated)):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Xabar bo‘sh")
    with db() as con:
        previous = [dict(row) for row in con.execute(
            "SELECT role,content FROM messages ORDER BY id DESC LIMIT 12")][::-1]
    history = previous + [{"role": "user", "content": text}]
    answer = await ask_model(
        "Sen DODA, Hikmatulloning shaxsiy agentisan. O‘zbek tilida aniq va rost javob ber. "
        "O‘zing bajarmagan ishni bajarildi deb aytma. Tashqi amal, xarajat, nashr yoki yangi agentni "
        "tasdiqsiz bajarma. Shu interfeysda faqat suhbat qila olasan; topshiriqlar alohida boshqariladi.",
        history, body.provider, body.model)
    now = int(time.time())
    with db() as con:
        con.execute("INSERT INTO messages(role,content,created_at) VALUES (?,?,?)", ("user", text, now))
        con.execute("INSERT INTO messages(role,content,created_at) VALUES (?,?,?)", ("assistant", answer, now))
    return {"reply": answer}


if __name__ == "__main__":
    print("Run: uvicorn backend.server:app --host 0.0.0.0 --port 8000")
