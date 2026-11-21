import type { Db } from "./db.js";

export const REQUIRED_CONSENTS = ["terms", "personal_data", "cross_border"] as const;
export type ConsentType = (typeof REQUIRED_CONSENTS)[number] | "voice";

export function recordConsent(
  db: Db,
  p: { userId: string; type: ConsentType; version: string; accepted: boolean; ip: string; userAgent: string; at: number },
): void {
  db.prepare(
    "INSERT INTO consents (user_id, type, version, accepted, ip, user_agent, created_at) VALUES (?,?,?,?,?,?,?)",
  ).run(p.userId, p.type, p.version, p.accepted ? 1 : 0, p.ip, p.userAgent.slice(0, 300), p.at);
}

/** Har tur bo'yicha oxirgi holat */
export function currentConsents(db: Db, userId: string): Record<string, { accepted: boolean; version: string; at: number }> {
  const rows = db
    .prepare(
      `SELECT c.type, c.accepted, c.version, c.created_at
         FROM consents c
         JOIN (SELECT type, MAX(id) AS id FROM consents WHERE user_id = ? GROUP BY type) last ON last.id = c.id`,
    )
    .all(userId) as Array<{ type: string; accepted: number; version: string; created_at: number }>;
  return Object.fromEntries(rows.map((r) => [r.type, { accepted: r.accepted === 1, version: r.version, at: r.created_at }]));
}
