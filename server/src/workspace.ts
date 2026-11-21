import type { Db } from "./db.js";

/** Foydalanuvchining "ishchi maydoni": matnli fayllar (virtual papka), har o'zgarish versiyalanadi (bekor qilish mumkin). */
export const LIMITS = { fileBytes: 64 * 1024, files: 200, totalBytes: 5 * 1024 * 1024, versions: 20, depth: 4, pathLen: 120, segLen: 60 };

export type WsCode = "invalid_path" | "file_too_large" | "too_many_files" | "storage_full" | "conflict" | "not_found";
export class WsError extends Error {
  constructor(public code: WsCode) {
    super(code);
    this.name = "WsError";
  }
}

export type Author = "user" | "doda";

export interface FileInfo {
  path: string;
  size: number;
  version: number;
  updatedAt: number;
  updatedBy: Author;
}

const SEGMENT = /^[\p{L}\p{N}_\- .]+$/u;

/** Xavfsiz yo'l: papkadan chiqish (..), yashirin fayllar, kengaytma cheklovi */
export function normalizePath(raw: string): string {
  const p = String(raw).normalize("NFC").trim();
  if (!p || p.length > LIMITS.pathLen || p.includes("\\") || p.startsWith("/") || p.endsWith("/")) throw new WsError("invalid_path");
  const segs = p.split("/");
  if (segs.length > LIMITS.depth) throw new WsError("invalid_path");
  for (const s of segs) {
    if (!s || s === "." || s === ".." || s.startsWith(".") || s.length > LIMITS.segLen || s !== s.trim() || s.endsWith(".") || !SEGMENT.test(s)) throw new WsError("invalid_path");
  }
  const last = segs[segs.length - 1]!.toLowerCase();
  if (!(last.endsWith(".md") || last.endsWith(".txt")) || last === ".md" || last === ".txt") throw new WsError("invalid_path");
  return segs.join("/");
}

export const PROFILE_PATH = "profil.md";
export const FACTS_PATH = "xotira/faktlar.md";

const PROFILE_TEMPLATE = `# Men haqimda

<!-- Bu faylni o'zingiz tahrirlang. DODA uni har suhbatda hisobga oladi. Bo'sh qatorlar hisobga olinmaydi. -->

- Ism:
- Kasb / lavozim:
- Muhim loyihalarim:
- Javob uslubi (qisqa yoki batafsil):
`;

const FACTS_HEADER = `# DODA eslab qolgan faktlar\n\n<!-- DODA suhbatlardan ajratgan uzoq muddatli faktlar. Xohlaganingizni o'zgartiring yoki o'chiring. -->\n\n`;

export function ensureDefaults(db: Db, userId: string, now: number): void {
  const n = (db.prepare("SELECT COUNT(*) c FROM files WHERE user_id = ?").get(userId) as { c: number }).c;
  if (n > 0) return;
  writeFile(db, userId, PROFILE_PATH, PROFILE_TEMPLATE, "doda", now);
  writeFile(db, userId, FACTS_PATH, FACTS_HEADER, "doda", now);
}

export function listFiles(db: Db, userId: string): FileInfo[] {
  const rows = db
    .prepare("SELECT path, LENGTH(CAST(content AS BLOB)) size, version, updated_at, updated_by FROM files WHERE user_id = ? ORDER BY path")
    .all(userId) as Array<{ path: string; size: number; version: number; updated_at: number; updated_by: Author }>;
  return rows.map((r) => ({ path: r.path, size: r.size, version: r.version, updatedAt: r.updated_at, updatedBy: r.updated_by }));
}

export function readFile(db: Db, userId: string, rawPath: string): { path: string; content: string; version: number; updatedAt: number; updatedBy: Author } {
  const path = normalizePath(rawPath);
  const r = db.prepare("SELECT content, version, updated_at, updated_by FROM files WHERE user_id = ? AND path = ?").get(userId, path) as
    | { content: string; version: number; updated_at: number; updated_by: Author }
    | undefined;
  if (!r) throw new WsError("not_found");
  return { path, content: r.content, version: r.version, updatedAt: r.updated_at, updatedBy: r.updated_by };
}

/**
 * Yozish: yaratish yoki yangilash. baseVersion berilsa va fayl o'zgargan bo'lsa, 'conflict' (boshqa yozuvni bosib ketmaslik uchun).
 * Mazmun bir xil bo'lsa, yangi versiya yaratilmaydi.
 */
export function writeFile(
  db: Db,
  userId: string,
  rawPath: string,
  content: string,
  by: Author,
  now: number,
  baseVersion?: number,
): { path: string; version: number; changed: boolean } {
  const path = normalizePath(rawPath);
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > LIMITS.fileBytes) throw new WsError("file_too_large");

  const existing = db.prepare("SELECT id, content, version FROM files WHERE user_id = ? AND path = ?").get(userId, path) as
    | { id: number; content: string; version: number }
    | undefined;

  if (existing) {
    if (baseVersion !== undefined && baseVersion !== existing.version) throw new WsError("conflict");
    if (existing.content === content) return { path, version: existing.version, changed: false };
  } else {
    const count = (db.prepare("SELECT COUNT(*) c FROM files WHERE user_id = ?").get(userId) as { c: number }).c;
    if (count >= LIMITS.files) throw new WsError("too_many_files");
  }
  const total = (db.prepare("SELECT COALESCE(SUM(LENGTH(CAST(content AS BLOB))),0) t FROM files WHERE user_id = ?").get(userId) as { t: number }).t;
  const oldBytes = existing ? Buffer.byteLength(existing.content, "utf8") : 0;
  if (total - oldBytes + bytes > LIMITS.totalBytes) throw new WsError("storage_full");

  let version = 1;
  db.transaction(() => {
    let fileId: number;
    if (existing) {
      version = existing.version + 1;
      fileId = existing.id;
      db.prepare("UPDATE files SET content = ?, version = ?, updated_at = ?, updated_by = ? WHERE id = ?").run(content, version, now, by, fileId);
    } else {
      const r = db.prepare("INSERT INTO files (user_id, path, content, version, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?,?)").run(userId, path, content, 1, now, now, by);
      fileId = Number(r.lastInsertRowid);
    }
    db.prepare("INSERT INTO file_versions (file_id, version, content, updated_by, created_at) VALUES (?,?,?,?,?)").run(fileId, version, content, by, now);
    db.prepare("DELETE FROM file_versions WHERE file_id = ? AND version <= ?").run(fileId, version - LIMITS.versions);
  })();
  return { path, version, changed: true };
}

export function deleteFile(db: Db, userId: string, rawPath: string): void {
  const path = normalizePath(rawPath);
  const r = db.prepare("DELETE FROM files WHERE user_id = ? AND path = ?").run(userId, path);
  if (r.changes === 0) throw new WsError("not_found");
}

export function listVersions(db: Db, userId: string, rawPath: string): Array<{ version: number; updatedAt: number; updatedBy: string; size: number }> {
  const path = normalizePath(rawPath);
  const f = db.prepare("SELECT id FROM files WHERE user_id = ? AND path = ?").get(userId, path) as { id: number } | undefined;
  if (!f) throw new WsError("not_found");
  const rows = db
    .prepare("SELECT version, created_at, updated_by, LENGTH(CAST(content AS BLOB)) size FROM file_versions WHERE file_id = ? ORDER BY version DESC")
    .all(f.id) as Array<{ version: number; created_at: number; updated_by: string; size: number }>;
  return rows.map((r) => ({ version: r.version, updatedAt: r.created_at, updatedBy: r.updated_by, size: r.size }));
}

/** Eski versiyani tiklash = uning mazmunini yangi versiya sifatida yozish (tarix yo'qolmaydi) */
export function restoreVersion(db: Db, userId: string, rawPath: string, version: number, now: number): { version: number } {
  const path = normalizePath(rawPath);
  const f = db.prepare("SELECT id FROM files WHERE user_id = ? AND path = ?").get(userId, path) as { id: number } | undefined;
  if (!f) throw new WsError("not_found");
  const v = db.prepare("SELECT content FROM file_versions WHERE file_id = ? AND version = ?").get(f.id, version) as { content: string } | undefined;
  if (!v) throw new WsError("not_found");
  const r = writeFile(db, userId, path, v.content, "user", now);
  return { version: r.version };
}
