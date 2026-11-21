import { Hono } from "hono";
import { z } from "zod";
import { currentConsents } from "../consents.js";
import { fail, type Env } from "../http.js";
import { recordUsage, sharedSpendUsd } from "../usage.js";
import { ChainError, chainFor, legacyChain, runChain } from "../llm/multi.js";
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
  const { db, config, limiter, now, llmFor } = c.get("deps");
  const user = c.get("user")!;
  const resolved = llmFor(user.id);
  if (!resolved) return fail(c, 403, "api_key_required");
  const { llm, own } = resolved;
  if (!currentConsents(db, user.id).voice?.accepted) return fail(c, 403, "voice_consent_required");
  if (!limiter.take(`stt:${user.id}`, 20, MIN)) return fail(c, 429, "too_many_requests");
  const body = schema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "audio_invalid");

  if (!own && sharedSpendUsd(db, user.id, now()) >= config.MONTHLY_BUDGET_USD) return fail(c, 429, "budget_exceeded");

  const mime = body.data.mime.split(";")[0]!.toLowerCase();
  let r;
  let model = "";
  try {
    // Faqat ovozni biladigan provayderlar: Claude o'tkazib yuboriladi (501), keyingisiga o'tiladi
    const out = await runChain(chainFor({ llm, legacy: legacyChain(config) }, "stt"), (m) => llm.transcribe({ model: m, mime, data: body.data.data, lang: body.data.lang }));
    r = out.result;
    model = out.model;
  } catch (e) {
    const code = e instanceof ChainError ? e.code : "llm_unavailable";
    console.error("[voice] model xatosi:", e instanceof ChainError ? e.statuses.join(",") : "noma'lum");
    if (code === "llm_rate_limited") return fail(c, 429, code);
    if (e instanceof ChainError && e.statuses.length && e.statuses.every((s) => s === 400)) return fail(c, 400, "audio_invalid");
    return fail(c, 503, code);
  }
  recordUsage(db, { userId: user.id, model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, own, now: now() });
  return c.json({ text: r.text.replace(/\s+/g, " ").trim().slice(0, 4000) });
});

/** Interfeys: serverda ovozni matnga aylantirish bormi (bo'lmasa, brauzer tanishi ishlatiladi) */
voiceRoutes.get("/status", (c) => {
  const { config, llmFor } = c.get("deps");
  const resolved = llmFor(c.get("user")!.id);
  const on = !!resolved && chainFor({ llm: resolved.llm, legacy: legacyChain(config) }, "stt").some((m) => m.startsWith("gemini-") || m.startsWith("gpt-"));
  return c.json({ server: on });
});
