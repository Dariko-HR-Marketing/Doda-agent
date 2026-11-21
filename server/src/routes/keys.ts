import { Hono } from "hono";
import { z } from "zod";
import { fail, userRef, type Env } from "../http.js";
import { LlmHttpError } from "../llm/types.js";
import { requireAuth } from "../session.js";
import { KEY_FORMAT, PROVIDERS, cleanKey, deleteKey, listKeys, probeKey, saveKey } from "../userkeys.js";
import type { ProviderName } from "../llm/multi.js";

export const keyRoutes = new Hono<Env>();
keyRoutes.use("*", requireAuth);

const putSchema = z.object({ key: z.string().min(1).max(400), verify: z.boolean().default(true) });
const isProvider = (p: string): p is ProviderName => (PROVIDERS as string[]).includes(p);

function audit(c: { get: (k: "deps") => { db: import("../db.js").Db; now: () => number } }, userId: string, action: string): void {
  const { db, now } = c.get("deps");
  db.prepare("INSERT INTO audit_log (user_ref, action, created_at) VALUES (?,?,?)").run(userRef(userId), action, now());
}

/** Qaysi provayderlar ulangan. Kalitning o'zi HECH QACHON qaytarilmaydi: faqat oxirgi 4 belgi. */
keyRoutes.get("/", (c) => {
  const { db, config, llm } = c.get("deps");
  const user = c.get("user")!;
  const have = new Map(listKeys(db, user.id).map((k) => [k.provider, k]));
  return c.json({
    storageReady: !!config.KEYS_SECRET,
    sharedAvailable: !!llm,
    providers: PROVIDERS.map((id) => {
      const k = have.get(id);
      return { id, connected: !!k, last4: k?.last4 ?? null, status: k?.status ?? null, updatedAt: k?.updatedAt ?? null };
    }),
  });
});

keyRoutes.put("/:provider", async (c) => {
  const { db, config, limiter, userLlm, factory, now } = c.get("deps");
  const user = c.get("user")!;
  const provider = c.req.param("provider");
  if (!isProvider(provider)) return fail(c, 404, "not_found");
  if (!config.KEYS_SECRET) return fail(c, 503, "keys_not_configured");
  if (!limiter.take(`keys:${user.id}`, 10, 10 * 60_000)) return fail(c, 429, "too_many_requests");
  const body = putSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "key_invalid_format");
  const key = cleanKey(body.data.key);
  if (!KEY_FORMAT[provider].test(key)) return fail(c, 400, "key_invalid_format");

  let warning: "quota" | "unverified" | null = null;
  if (body.data.verify) {
    try {
      await probeKey(config, factory, provider, key);
    } catch (e) {
      const status = e instanceof LlmHttpError ? e.status : 0;
      if (status === 401 || status === 403) return fail(c, 400, "key_rejected");
      if (status === 429) warning = "quota"; // kalit to'g'ri, lekin hozir chegara tugagan: saqlaymiz
      else if (status === 400 || status === 402 || status === 404) return fail(c, 400, "key_check_failed");
      else return fail(c, 503, "key_check_unreachable");
    }
  } else warning = "unverified";

  saveKey(db, config.KEYS_SECRET, user.id, provider, key, now());
  userLlm.invalidate(user.id);
  audit(c, user.id, `key_set:${provider}`);
  return c.json({ provider, connected: true, last4: key.slice(-4), status: "active", warning });
});

keyRoutes.delete("/:provider", (c) => {
  const { db, userLlm } = c.get("deps");
  const user = c.get("user")!;
  const provider = c.req.param("provider");
  if (!isProvider(provider)) return fail(c, 404, "not_found");
  const removed = deleteKey(db, user.id, provider);
  userLlm.invalidate(user.id);
  if (removed) audit(c, user.id, `key_delete:${provider}`);
  return c.json({ provider, connected: false });
});
