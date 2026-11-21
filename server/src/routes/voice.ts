import { Hono } from "hono";
import { z } from "zod";
import { currentConsents } from "../consents.js";
import { fail, type Env } from "../http.js";
import { costUsd } from "../llm/pricing.js";
import { LlmHttpError } from "../llm/types.js";
import { requireAuth } from "../session.js";

export const voiceRoutes = new Hono<Env>();
voiceRoutes.use("*", requireAuth);

const MIN = 60_000;
/** ~2 daqiqalik siqilgan ovoz uchun yetarli (base64 ~ 2 MB) */
const MAX_B64 = 1_900_000;

const schema = z.object({
  mime: z.string().regex(/^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac|x-m4a)(;[\w=.\-, ]*)?$/i),
  data: z.string().min(100).max(MAX_B64).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  lang: z.enum(["uz", "ru"]).default("uz"),
});

/** Ovoz -> matn. Audio faqat xotirada ushlanadi: diskka yoki bazaga YOZILMAYDI. Rozilik talab qilinadi. */
voiceRoutes.post("/transcribe", async (c) => {
  const { db, config, llm, limiter, now } = c.get("deps");
  const user = c.get("user")!;
  if (!llm) return fail(c, 503, "llm_unavailable");
  if (!currentConsents(db, user.id).voice?.accepted) return fail(c, 403, "voice_consent_required");
  if (!limiter.take(`stt:${user.id}`, 20, MIN)) return fail(c, 429, "too_many_requests");
  const body = schema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "audio_invalid");

  const d = new Date(now());
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const spent = (db.prepare("SELECT COALESCE(SUM(cost_usd),0) usd FROM usage WHERE user_id = ? AND created_at >= ?").get(user.id, monthStart) as { usd: number }).usd;
  if (spent >= config.MONTHLY_BUDGET_USD) return fail(c, 429, "budget_exceeded");

  let model = config.GEMINI_MODEL_STT;
  const call = (m: string) => llm.transcribe({ model: m, mime: body.data.mime.split(";")[0]!.toLowerCase(), data: body.data.data, lang: body.data.lang });
  let r;
  try {
    try {
      r = await call(model);
    } catch (e) {
      if (model === config.GEMINI_MODEL_MAIN || (e instanceof LlmHttpError && e.status === 429)) throw e;
      model = config.GEMINI_MODEL_MAIN;
      r = await call(model);
    }
  } catch (e) {
    console.error("[voice] model xatosi:", e instanceof LlmHttpError ? `status ${e.status}` : "noma'lum");
    if (e instanceof LlmHttpError && e.status === 429) return fail(c, 429, "llm_rate_limited");
    if (e instanceof LlmHttpError && e.status === 400) return fail(c, 400, "audio_invalid");
    return fail(c, 503, "llm_unavailable");
  }
  db.prepare("INSERT INTO usage (user_id, conversation_id, model, tokens_in, tokens_out, cost_usd, created_at) VALUES (?,?,?,?,?,?,?)").run(
    user.id, null, model, r.tokensIn, r.tokensOut, costUsd(model, r.tokensIn, r.tokensOut, now()), now(),
  );
  return c.json({ text: r.text.replace(/\s+/g, " ").trim().slice(0, 4000) });
});
