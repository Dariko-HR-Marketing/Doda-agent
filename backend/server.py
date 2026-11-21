"""Single-user DODA API. Run behind the existing HTTPS reverse proxy."""

import base64
import binascii
import getpass
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


DB_PATH = Path(os.getenv("DODA_DB_PATH", "/data/doda.sqlite3"))
FILES_PATH = Path(os.getenv("DODA_FILES_PATH", "/data/files"))
ORIGIN = os.getenv("DODA_PUBLIC_ORIGIN", "https://doda.tajriba24.uz").rstrip("/")
COOKIE = "__Host-doda_session"
SESSION_SECONDS = 7 * 24 * 3600
MAX_FILE = 20 * 1024 * 1024
ALLOWED_AGENTS = ("Hujjat va sifat agenti", "HR jarayonlari agenti", "Marketing va tadqiqot agenti")
SUPPORTED_FILES = {".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".xlsx", ".pptx"}
attempts = defaultdict(deque)


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
        """)


@asynccontextmanager
async def lifespan(_app):
    init()
    yield


app = FastAPI(title="DODA", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


def password_hash(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return f"scrypt:{salt.hex()}:{digest.hex()}"


def check_password(password):
    encoded = os.getenv("DODA_PASSWORD_HASH", "")
    try:
        algorithm, salt, expected = encoded.split(":")
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
        return hmac.compare_digest(digest, bytes.fromhex(expected))
    except (ValueError, binascii.Error):
        return False


def secret_key():
    key = os.getenv("DODA_SESSION_SECRET", "")
    if len(key) < 32:
        raise HTTPException(503, "Session secret sozlanmagan")
    return key.encode()


def signed_session():
    expiry = str(int(time.time()) + SESSION_SECONDS)
    nonce = secrets.token_urlsafe(16)
    payload = f"{expiry}.{nonce}"
    signature = hmac.new(secret_key(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def authenticated(request: Request):
    token = request.cookies.get(COOKIE, "")
    try:
        expiry, nonce, signature = token.split(".")
        payload = f"{expiry}.{nonce}"
        expected = hmac.new(secret_key(), payload.encode(), hashlib.sha256).hexdigest()
        if int(expiry) <= time.time() or not hmac.compare_digest(signature, expected):
            raise ValueError()
    except (ValueError, HTTPException):
        raise HTTPException(401, "Kirish talab qilinadi")
    return True


@app.middleware("http")
async def same_origin(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        fetch_site = request.headers.get("sec-fetch-site")
        if (origin and origin != ORIGIN) or fetch_site == "cross-site":
            return Response(status_code=403)
    return await call_next(request)


class Login(BaseModel):
    password: str = Field(min_length=1, max_length=512)


@app.post("/api/login")
def login(body: Login, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    bucket = attempts[ip]
    while bucket and bucket[0] < now - 900:
        bucket.popleft()
    if len(bucket) >= 8:
        raise HTTPException(429, "Ko‘p urinish. 15 daqiqadan keyin qayta sinang")
    if not check_password(body.password):
        bucket.append(now)
        raise HTTPException(401, "Kirish ma’lumotlari noto‘g‘ri")
    bucket.clear()
    response.set_cookie(COOKIE, signed_session(), max_age=SESSION_SECONDS,
                        secure=True, httponly=True, samesite="strict", path="/")
    return {"ok": True}


@app.get("/api/session")
def session(_=Depends(authenticated)):
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response, _=Depends(authenticated)):
    response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="strict")
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
def import_legacy(body: LegacyImport, _=Depends(authenticated)):
    """Import existing same-origin browser tasks after their file blobs were uploaded."""
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
def task_action(task_id: str, body: TaskAction, _=Depends(authenticated)):
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


def provider_order():
    order = [item.strip().lower() for item in os.getenv("DODA_AI_ORDER", "openai,gemini").split(",")]
    if not order or len(order) != len(set(order)) or any(item not in ("openai", "gemini") for item in order):
        raise HTTPException(503, "AI xizmatlari tartibi noto‘g‘ri sozlangan")
    return order


def provider_configured(provider):
    if provider == "openai":
        return bool(os.getenv("OPENAI_API_KEY") and os.getenv("DODA_MODEL"))
    return bool(os.getenv("GEMINI_API_KEY") and os.getenv("DODA_GEMINI_MODEL"))


@app.get("/api/ai/status")
def ai_status(_=Depends(authenticated)):
    return {"order": provider_order(), "configured": {name: provider_configured(name)
            for name in ("openai", "gemini")}}


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


async def call_provider(provider, instructions, history):
    key = os.environ["OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"]
    model = os.environ["DODA_MODEL" if provider == "openai" else "DODA_GEMINI_MODEL"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", model):
        raise HTTPException(503, f"{provider} model nomi noto‘g‘ri sozlangan")
    if provider == "openai":
        url = "https://api.openai.com/v1/responses"
        headers = {"Authorization": f"Bearer {key}"}
        payload = {"model": model, "instructions": instructions, "input": history,
                   "store": False, "max_output_tokens": 1500}
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {"x-goog-api-key": key}
        payload = {"systemInstruction": {"parts": [{"text": instructions}]},
                   "contents": gemini_contents(history), "generationConfig": {"maxOutputTokens": 1500}}
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
        else:
            output = "\n".join(part.get("text", "") for candidate in data.get("candidates", [])[:1]
                               for part in candidate.get("content", {}).get("parts", [])).strip()
        if not output:
            raise ValueError("Bo‘sh javob")
        return output
    except (httpx.HTTPError, ValueError, UnicodeError, binascii.Error):
        raise HTTPException(502, f"{provider} vaqtincha javob bermadi")


async def ask_model(instructions: str, history: list[dict]):
    available = [name for name in provider_order() if provider_configured(name)]
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
            return await call_provider(provider, instructions, history)
        except HTTPException as error:
            if error.status_code != 502:
                raise
            last_failure = error
    raise last_failure


@app.post("/api/tasks/{task_id}/run")
async def run_task(task_id: str, _=Depends(authenticated)):
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
        [{"role": "user", "content": content}])
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
        "tasdiqsiz bajarma. Shu interfeysda faqat suhbat qila olasan; topshiriqlar alohida boshqariladi.", history)
    now = int(time.time())
    with db() as con:
        con.execute("INSERT INTO messages(role,content,created_at) VALUES (?,?,?)", ("user", text, now))
        con.execute("INSERT INTO messages(role,content,created_at) VALUES (?,?,?)", ("assistant", answer, now))
    return {"reply": answer}


if __name__ == "__main__":
    if sys.argv[1:] == ["hash-password"]:
        print(password_hash(getpass.getpass("DODA login paroli: ")))
    else:
        print("Run: uvicorn backend.server:app --host 0.0.0.0 --port 8000")
