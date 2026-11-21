import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

/** Migratsiyalar tartib bilan; PRAGMA user_version orqali kuzatiladi. Mavjudini o'zgartirmang, yangisini qo'shing. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_sub    TEXT UNIQUE,
    email_verified_at INTEGER,
    locale        TEXT NOT NULL DEFAULT 'uz' CHECK (locale IN ('uz','ru')),
    created_at    INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id_hash    TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ip         TEXT,
    user_agent TEXT
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE INDEX sessions_expires ON sessions(expires_at);
  CREATE TABLE email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
    expires_at INTEGER NOT NULL,
    used_at    INTEGER
  );
  -- Rozilik jurnali: faqat qo'shiladi. Joriy holat = har tur bo'yicha oxirgi yozuv.
  CREATE TABLE consents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('terms','personal_data','cross_border','voice')),
    version    TEXT NOT NULL,
    accepted   INTEGER NOT NULL CHECK (accepted IN (0,1)),
    ip         TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX consents_user ON consents(user_id, type, id);
  -- Audit jurnali shaxsiy ma'lumotsiz: user_ref = foydalanuvchi ID'sining xeshi
  CREATE TABLE audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_ref   TEXT,
    action     TEXT NOT NULL,
    meta       TEXT,
    created_at INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE oauth_states (
    state_hash TEXT PRIMARY KEY,
    verifier   TEXT NOT NULL,
    consents   TEXT,
    locale     TEXT NOT NULL DEFAULT 'uz',
    expires_at INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE conversations (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX conversations_user ON conversations(user_id, updated_at DESC);
  CREATE TABLE messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content         TEXT NOT NULL,
    model           TEXT,
    tokens_in       INTEGER,
    tokens_out      INTEGER,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX messages_conv ON messages(conversation_id, id);
  CREATE TABLE usage (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT,
    model           TEXT NOT NULL,
    tokens_in       INTEGER NOT NULL,
    tokens_out      INTEGER NOT NULL,
    cost_usd        REAL NOT NULL,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX usage_user ON usage(user_id, created_at);
  `,
  `
  ALTER TABLE users ADD COLUMN memory_enabled INTEGER NOT NULL DEFAULT 1;
  CREATE TABLE files (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    path       TEXT NOT NULL,
    content    TEXT NOT NULL,
    version    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL CHECK (updated_by IN ('user','doda')),
    UNIQUE (user_id, path)
  );
  CREATE TABLE file_versions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version    INTEGER NOT NULL,
    content    TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX file_versions_file ON file_versions(file_id, version);
  `,
  `
  CREATE TABLE tasks (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    goal       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','archived')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX tasks_user ON tasks(user_id, updated_at);
  CREATE TABLE task_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    stage    INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 5),
    text     TEXT NOT NULL,
    done     INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL
  );
  CREATE INDEX task_items_task ON task_items(task_id, stage, position);
  CREATE TABLE task_stages (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    stage   INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 5),
    name    TEXT NOT NULL,
    PRIMARY KEY (task_id, stage)
  );
  `,
  `
  CREATE TABLE agents (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template     TEXT,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL,
    instructions TEXT NOT NULL,
    created_at   INTEGER NOT NULL
  );
  CREATE INDEX agents_user ON agents(user_id, created_at);
  CREATE TABLE agent_runs (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id    TEXT,
    request    TEXT NOT NULL,
    brief      TEXT NOT NULL,
    result     TEXT NOT NULL,
    verdict    TEXT NOT NULL CHECK (verdict IN ('ok','needs_work','unchecked')),
    review     TEXT NOT NULL DEFAULT '',
    model      TEXT NOT NULL,
    cost_usd   REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX agent_runs_agent ON agent_runs(agent_id, created_at);
  `,
  `
  -- Foydalanuvchining shaxsiy AI kalitlari: faqat shifrlangan holda (AES-256-GCM). Ochiq matn hech qayerda saqlanmaydi.
  CREATE TABLE user_api_keys (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider   TEXT NOT NULL CHECK (provider IN ('anthropic','gemini','openai')),
    enc        TEXT NOT NULL,
    last4      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invalid')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, provider)
  );
  -- own=1: sarf foydalanuvchining o'z kaliti bilan (uning shaxsiy hisobidan); own=0: server kaliti
  ALTER TABLE usage ADD COLUMN own INTEGER NOT NULL DEFAULT 0;
  `,
  `
  -- Agent imkoniyatlari (katalogdan tanlangan id lar) va foydalanuvchining o'z qo'shimchalari
  ALTER TABLE agents ADD COLUMN capabilities TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE agents ADD COLUMN custom_items TEXT NOT NULL DEFAULT '[]';
  -- To-do ro'yxatlari: agent_id NULL = DODA (bosh agent) ro'yxati, aks holda shu agentniki
  CREATE TABLE todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id   TEXT REFERENCES agents(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    priority   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX todos_scope ON todos(user_id, agent_id, done);
  -- Har bir agentning shaxsiy xotirasi (boshqa agent ko'rmaydi)
  CREATE TABLE agent_memory (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('fact','lesson','preference')),
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX agent_memory_agent ON agent_memory(agent_id, created_at);
  `,
];

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
