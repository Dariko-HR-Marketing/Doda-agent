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

/** Foydalanuvchining barcha ma'lumotini JSON ko'rinishida yuklab olish (parol hash va AI kalitlari kirmaydi). */
accountRoutes.get("/export", (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const all = (sql: string, ...a: unknown[]) => db.prepare(sql).all(...a);
  const conversations = (all("SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY created_at", user.id) as Array<{ id: string }>).map((cv) => ({
    ...cv,
    messages: all("SELECT role, content, model, created_at FROM messages WHERE conversation_id = ? ORDER BY id", cv.id),
  }));
  const tasks = (all("SELECT id, title, goal, status, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY created_at", user.id) as Array<{ id: string }>).map((tk) => ({
    ...tk,
    stages: all("SELECT stage, name FROM task_stages WHERE task_id = ? ORDER BY stage", tk.id),
    items: all("SELECT stage, text, done FROM task_items WHERE task_id = ? ORDER BY stage, position", tk.id),
  }));
  const agents = (all("SELECT id, template, name, role, instructions, capabilities, custom_items, created_at FROM agents WHERE user_id = ? ORDER BY created_at", user.id) as Array<{ id: string }>).map((a) => ({
    ...a,
    memory: all("SELECT kind, text, created_at FROM agent_memory WHERE agent_id = ? ORDER BY id", a.id),
    runs: all("SELECT task_id, request, result, verdict, review, model, created_at FROM agent_runs WHERE agent_id = ? ORDER BY created_at", a.id),
  }));
  const data = {
    exportedAt: new Date(now()).toISOString(),
    profile: all("SELECT email, locale, memory_enabled, created_at FROM users WHERE id = ?", user.id)[0],
    consents: all("SELECT type, version, accepted, created_at FROM consents WHERE user_id = ? ORDER BY id", user.id),
    conversations,
    files: all("SELECT path, content, version, updated_by, updated_at FROM files WHERE user_id = ? ORDER BY path", user.id),
    tasks,
    agents,
    todos: all("SELECT agent_id, text, done, due, repeat, created_at FROM todos WHERE user_id = ? ORDER BY id", user.id),
    usage: all("SELECT model, tokens_in, tokens_out, cost_usd, own, created_at FROM usage WHERE user_id = ? ORDER BY id", user.id),
    aiKeys: all("SELECT provider, last4, status FROM user_api_keys WHERE user_id = ?", user.id),
  };
  db.prepare("INSERT INTO audit_log (user_ref, action, created_at) VALUES (?,?,?)").run(userRef(user.id), "account_export", now());
  c.header("content-disposition", 'attachment; filename="doda-ma-lumotlarim.json"');
  c.header("cache-control", "no-store");
  return c.json(data);
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
