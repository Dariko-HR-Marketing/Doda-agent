import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, type Env } from "../http.js";
import { t } from "../i18n.js";
import { costUsd } from "../llm/pricing.js";
import { systemPrompt } from "../llm/prompt.js";
import { extractAndStore, loadMemoryContext, maybeMemorable } from "../memory.js";
import { ensureDefaults } from "../workspace.js";
import { pickTier } from "../llm/router.js";
import { LlmHttpError, type LlmMessage } from "../llm/types.js";
import { chainFor, failureCode, legacyChain, runChain } from "../llm/multi.js";
import { requireAuth } from "../session.js";

export const chatRoutes = new Hono<Env>();
chatRoutes.use("*", requireAuth);

const MAX_CONTEXT_CHARS = 24_000;
const MIN = 60 * 1000;

/** Biriktirilgan matnli fayllar xabar ichida shu belgidan keyin keladi (sarlavha va ko'rinish uchun ajratiladi) */
export const ATTACH_MARK = "\n\n---\n[Biriktirilgan fayl:";

const chatSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(20_000),
  /** auto = DODA o'zi tanlaydi (tejamkor); light = tez/arzon; main = aqlli */
  tier: z.enum(["auto", "light", "main"]).default("auto"),
});

/** Ketma-ket bir xil rolli xabarlarni birlashtiradi va suhbat 'user' bilan boshlanishini ta'minlaydi (model talabi) */
export function normalizeHistory(msgs: LlmMessage[], maxChars = MAX_CONTEXT_CHARS): LlmMessage[] {
  const merged: LlmMessage[] = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ ...m });
  }
  // Eng eskilarini tashlaymiz, eng so'nggi xabar doim qoladi
  let total = merged.reduce((n, m) => n + m.content.length, 0);
  while (merged.length > 1 && total > maxChars) total -= merged.shift()!.content.length;
  while (merged.length > 1 && merged[0]!.role !== "user") merged.shift();
  return merged;
}

function monthStartUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function monthlySpend(db: import("../db.js").Db, userId: string, now: number): { usd: number; tokensIn: number; tokensOut: number } {
  const r = db
    .prepare("SELECT COALESCE(SUM(cost_usd),0) usd, COALESCE(SUM(tokens_in),0) tin, COALESCE(SUM(tokens_out),0) tout FROM usage WHERE user_id = ? AND created_at >= ?")
    .get(userId, monthStartUtc(now)) as { usd: number; tin: number; tout: number };
  return { usd: r.usd, tokensIn: r.tin, tokensOut: r.tout };
}

chatRoutes.post("/chat", async (c) => {
  const { db, config, llm, limiter, now } = c.get("deps");
  const user = c.get("user")!;
  if (!llm) return fail(c, 503, "llm_not_configured");
  if (!limiter.take(`chat:${user.id}`, 20, MIN)) return fail(c, 429, "too_many_requests");

  const body = chatSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const { message } = body.data;

  const spent = monthlySpend(db, user.id, now());
  if (spent.usd >= config.MONTHLY_BUDGET_USD) return fail(c, 429, "budget_exceeded");

  // Suhbat: mavjud (faqat egasiniki) yoki yangi
  let convId = body.data.conversationId;
  if (convId) {
    const own = db.prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?").get(convId, user.id);
    if (!own) return fail(c, 404, "not_found");
  } else {
    convId = randomUUID();
    const typed = message.split(ATTACH_MARK)[0]!.trim() || message;
    const title = typed.replace(/\s+/g, " ").slice(0, 60);
    db.prepare("INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?)").run(convId, user.id, title, now(), now());
  }
  const conversationId = convId;

  db.prepare("INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?,?,?,?)").run(conversationId, "user", message, now());

  const rows = db
    .prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?")
    .all(conversationId, config.HISTORY_MESSAGES) as LlmMessage[];
  const history = normalizeHistory(rows.reverse());

  const tier = body.data.tier === "auto" ? pickTier(message, rows.length) : body.data.tier;
  const chain = chainFor({ llm, legacy: legacyChain(config) }, tier === "light" ? "light" : "main");
  const wanted = chain[0]!;
  const locale = user.locale;
  if (user.memoryEnabled) ensureDefaults(db, user.id, now());
  const system = systemPrompt(locale) + (user.memoryEnabled ? loadMemoryContext(db, user.id) : "");

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());
    let text = "";
    let tokensIn = 0;
    let tokensOut = 0;
    let gotUsage = false;
    let failed = false;

    let model = wanted;
    await stream.writeSSE({ event: "meta", data: JSON.stringify({ conversationId, model, tier }) });
    // Provayder/model xato bersa (band, hudud, to'lov, kvota) va hali matn kelmagan bo'lsa, zanjirdagi keyingisiga o'tamiz
    const statuses: number[] = [];
    for (let attempt = 0; attempt < chain.length; attempt++) {
      model = chain[attempt]!;
      if (attempt > 0) await stream.writeSSE({ event: "meta", data: JSON.stringify({ conversationId, model, tier, fallback: true }) });
      try {
        for await (const ev of llm.stream({ model, system, messages: history, signal: controller.signal })) {
          if (ev.type === "delta") {
            text += ev.text;
            await stream.writeSSE({ event: "delta", data: JSON.stringify({ text: ev.text }) });
          } else {
            tokensIn = ev.tokensIn;
            tokensOut = ev.tokensOut;
            gotUsage = true;
          }
        }
        failed = false;
        break;
      } catch (e) {
        failed = true;
        if (controller.signal.aborted) break;
        const status = e instanceof LlmHttpError ? e.status : 0;
        statuses.push(status);
        console.error(`[chat] model xatosi (${model}, status ${status}):`, e instanceof Error ? e.message.slice(0, 200) : "noma'lum");
        // Matn kelib bo'lgan bo'lsa, boshqa model bilan davom ettirmaymiz (aralash javob bo'lmasin)
        if (text.length > 0 || attempt === chain.length - 1) {
          const code = failureCode(statuses);
          await stream.writeSSE({ event: "error", data: JSON.stringify({ code, message: t(code, locale) }) });
          break;
        }
      }
    }

    // Model hech narsa qaytarmadi (masalan xavfsizlik filtri): foydalanuvchi bilsin, sarf yozilmasin
    if (!failed && text.length === 0 && !controller.signal.aborted) {
      await stream.writeSSE({ event: "error", data: JSON.stringify({ code: "llm_empty", message: t("llm_empty", locale) }) });
    }

    // Matn bo'lsa (hatto uzilgan bo'lsa ham) saqlaymiz; token ma'lumoti kelmasa, taxminiy baho
    if (text.length > 0) {
      if (!gotUsage) {
        tokensIn = Math.ceil(history.reduce((n, m) => n + m.content.length, 0) / 3);
        tokensOut = Math.ceil(text.length / 3);
      }
      const cost = costUsd(model, tokensIn, tokensOut, now());
      db.transaction(() => {
        db.prepare("INSERT INTO messages (conversation_id, role, content, model, tokens_in, tokens_out, created_at) VALUES (?,?,?,?,?,?,?)").run(
          conversationId, "assistant", text, model, tokensIn, tokensOut, now(),
        );
        db.prepare("INSERT INTO usage (user_id, conversation_id, model, tokens_in, tokens_out, cost_usd, created_at) VALUES (?,?,?,?,?,?,?)").run(
          user.id, conversationId, model, tokensIn, tokensOut, cost, now(),
        );
        db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now(), conversationId);
      })();
      if (!failed) {
        const after = monthlySpend(db, user.id, now());
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ tokensIn, tokensOut, costUsd: cost, monthUsd: after.usd, budgetUsd: config.MONTHLY_BUDGET_USD }),
        });

        // Xotira: faqat shaxsiy/doimiy ma'lumotga o'xshash xabarlar uchun, arzon modelda, javobdan KEYIN
        if (user.memoryEnabled && maybeMemorable(message) && !controller.signal.aborted) {
          try {
            const lightChain = chainFor({ llm, legacy: legacyChain(config) }, "light");
            let memModel = lightChain[0]!;
            const { result: mem } = await runChain(lightChain, (m) => { memModel = m; return extractAndStore(db, llm, m, user.id, message, now(), controller.signal); }, controller.signal);
            if (mem.tokensIn + mem.tokensOut > 0) {
              db.prepare("INSERT INTO usage (user_id, conversation_id, model, tokens_in, tokens_out, cost_usd, created_at) VALUES (?,?,?,?,?,?,?)").run(
                user.id, conversationId, memModel, mem.tokensIn, mem.tokensOut, costUsd(memModel, mem.tokensIn, mem.tokensOut, now()), now(),
              );
            }
            if (mem.added.length) await stream.writeSSE({ event: "memory", data: JSON.stringify({ facts: mem.added }) });
          } catch (e) {
            console.error("[memory] xato:", e instanceof Error ? e.message.slice(0, 120) : "noma'lum");
          }
        }
      }
    }
  });
});

chatRoutes.get("/conversations", (c) => {
  const { db } = c.get("deps");
  const rows = db
    .prepare("SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50")
    .all(c.get("user")!.id) as Array<{ id: string; title: string; updated_at: number }>;
  return c.json({ conversations: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at })) });
});

chatRoutes.get("/conversations/:id", (c) => {
  const { db } = c.get("deps");
  const id = c.req.param("id");
  const own = db.prepare("SELECT id, title FROM conversations WHERE id = ? AND user_id = ?").get(id, c.get("user")!.id) as { id: string; title: string } | undefined;
  if (!own) return fail(c, 404, "not_found");
  const msgs = db
    .prepare("SELECT role, content, model, created_at FROM messages WHERE conversation_id = ? ORDER BY id")
    .all(id) as Array<{ role: string; content: string; model: string | null; created_at: number }>;
  return c.json({ id: own.id, title: own.title, messages: msgs.map((m) => ({ role: m.role, content: m.content, model: m.model, createdAt: m.created_at })) });
});

chatRoutes.patch("/conversations/:id", async (c) => {
  const { db, now } = c.get("deps");
  const body = z.object({ title: z.string().trim().min(1).max(80) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const r = db.prepare("UPDATE conversations SET title = ?, updated_at = updated_at WHERE id = ? AND user_id = ?").run(body.data.title.replace(/\s+/g, " "), c.req.param("id"), c.get("user")!.id);
  void now;
  if (r.changes === 0) return fail(c, 404, "not_found");
  return c.json({ status: "renamed", title: body.data.title });
});

chatRoutes.delete("/conversations/:id", (c) => {
  const { db } = c.get("deps");
  const r = db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").run(c.req.param("id"), c.get("user")!.id);
  if (r.changes === 0) return fail(c, 404, "not_found");
  return c.json({ status: "deleted" });
});

chatRoutes.get("/usage", (c) => {
  const { db, config, now } = c.get("deps");
  const s = monthlySpend(db, c.get("user")!.id, now());
  return c.json({ monthUsd: s.usd, budgetUsd: config.MONTHLY_BUDGET_USD, tokensIn: s.tokensIn, tokensOut: s.tokensOut });
});
