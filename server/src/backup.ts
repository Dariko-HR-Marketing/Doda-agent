import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Db } from "./db.js";

const PATTERN = /^doda-\d{8}-\d{6}\.db$/;

function stamp(t: number): string {
  const d = new Date(t).toISOString(); // 2026-11-22T03:04:05.000Z
  return `${d.slice(0, 10).replace(/-/g, "")}-${d.slice(11, 19).replace(/:/g, "")}`;
}

/** Bazaning izchil nusxasi (VACUUM INTO): ish paytida ham xavfsiz. Eng yangi `keep` ta saqlanadi. */
export function backupDb(db: Db, dir: string, now: number, keep = 7): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `doda-${stamp(now)}.db`);
  rmSync(file, { force: true });
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = readdirSync(dir).filter((f) => PATTERN.test(f)).sort().reverse().slice(keep);
  for (const f of old) rmSync(join(dir, f), { force: true });
  return file;
}

export function backupDir(dbPath: string): string {
  return join(dirname(dbPath), "backups");
}

export function lastBackupAt(dir: string): string | null {
  try {
    const f = readdirSync(dir).filter((x) => PATTERN.test(x)).sort().pop();
    return f ?? null;
  } catch {
    return null;
  }
}
