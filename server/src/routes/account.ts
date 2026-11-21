import { Hono } from "hono";
import { z } from "zod";
import { currentConsents, recordConsent } from "../consents.js";
import { fail, userRef, type Env } from "../http.js";
import { destroySession, requireAuth } from "../session.js";

export const accountRoutes = new Hono<Env>();
accountRoutes.use("*", requireAuth);

const consentSchema = z.object({ type: z.literal("voice"), accepted: z.boolean() });

/** Faqat ixtiyoriy rozilikni (ovoz) o'zgartirish mumkin. Majburiylarni qaytarib olish = akkauntni o'chirish. */
accountRoutes.post("/consents", async (c) => {
  const { db, config, now } = c.get("deps");
  const body = consentSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const user = c.get("user")!;
  recordConsent(db, {
    userId: user.id,
    type: body.data.type,
    version: config.LEGAL_VERSION,
    accepted: body.data.accepted,
    ip: c.get("ip"),
    userAgent: c.req.header("user-agent") ?? "",
    at: now(),
  });
  return c.json({ consents: currentConsents(db, user.id) });
});

/** Xotira (DODA suhbatlardan eslab qolishi va saqlangan ma'lumotdan foydalanishi) */
accountRoutes.post("/memory", async (c) => {
  const { db, now } = c.get("deps");
  const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const user = c.get("user")!;
  db.prepare("UPDATE users SET memory_enabled = ? WHERE id = ?").run(body.data.enabled ? 1 : 0, user.id);
  db.prepare("INSERT INTO audit_log (user_ref, action, created_at) VALUES (?,?,?)").run(userRef(user.id), body.data.enabled ? "memory_on" : "memory_off", now());
  return c.json({ memoryEnabled: body.data.enabled });
});

/** Akkaunt va unga bog'liq barcha ma'lumotni o'chirish (rozilikni qaytarib olish huquqi) */
accountRoutes.delete("/", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  db.transaction(() => {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id); // sessions, consents, tokens CASCADE
    db.prepare("INSERT INTO audit_log (user_ref, action, created_at) VALUES (?,?,?)").run(
      userRef(user.id),
      "account_deleted",
      now(),
    );
  })();
  destroySession(c);
  return c.json({ status: "deleted" });
});
