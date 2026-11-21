import type { Db } from "./db.js";
import { costUsd } from "./llm/pricing.js";

export function monthStartUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Sarfni foydalanuvchi hisobiga yozadi. own=true: foydalanuvchining o'z kaliti (shaxsiy hisobidan). Narxni qaytaradi. */
export function recordUsage(db: Db, p: { userId: string; conversationId?: string | null; model: string; tokensIn: number; tokensOut: number; own: boolean; now: number }): number {
  const cost = costUsd(p.model, p.tokensIn, p.tokensOut, p.now);
  db.prepare("INSERT INTO usage (user_id, conversation_id, model, tokens_in, tokens_out, cost_usd, created_at, own) VALUES (?,?,?,?,?,?,?,?)").run(
    p.userId, p.conversationId ?? null, p.model, p.tokensIn, p.tokensOut, cost, p.now, p.own ? 1 : 0,
  );
  return cost;
}

/** Server kaliti bo'yicha oylik sarf (faqat shu byudjet bilan cheklanadi). Foydalanuvchining o'z kaliti cheklanmaydi. */
export function sharedSpendUsd(db: Db, userId: string, now: number): number {
  return (db.prepare("SELECT COALESCE(SUM(cost_usd),0) usd FROM usage WHERE user_id = ? AND own = 0 AND created_at >= ?").get(userId, monthStartUtc(now)) as { usd: number }).usd;
}

export interface UsageReport {
  monthUsd: number;
  ownUsd: number;
  sharedUsd: number;
  tokensIn: number;
  tokensOut: number;
  byProvider: Record<"anthropic" | "gemini" | "openai" | "other", { usd: number; tokensIn: number; tokensOut: number }>;
}

export function usageReport(db: Db, userId: string, now: number): UsageReport {
  const rows = db
    .prepare("SELECT model, own, SUM(cost_usd) usd, SUM(tokens_in) tin, SUM(tokens_out) tout FROM usage WHERE user_id = ? AND created_at >= ? GROUP BY model, own")
    .all(userId, monthStartUtc(now)) as Array<{ model: string; own: number; usd: number; tin: number; tout: number }>;
  const r: UsageReport = { monthUsd: 0, ownUsd: 0, sharedUsd: 0, tokensIn: 0, tokensOut: 0, byProvider: { anthropic: z(), gemini: z(), openai: z(), other: z() } };
  for (const x of rows) {
    r.monthUsd += x.usd; r.tokensIn += x.tin; r.tokensOut += x.tout;
    if (x.own) r.ownUsd += x.usd; else r.sharedUsd += x.usd;
    const k = x.model.startsWith("claude-") ? "anthropic" : x.model.startsWith("gemini-") ? "gemini" : x.model.startsWith("gpt-") ? "openai" : "other";
    r.byProvider[k].usd += x.usd; r.byProvider[k].tokensIn += x.tin; r.byProvider[k].tokensOut += x.tout;
  }
  return r;
}
const z = () => ({ usd: 0, tokensIn: 0, tokensOut: 0 });
