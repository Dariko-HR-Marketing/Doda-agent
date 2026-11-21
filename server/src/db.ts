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
