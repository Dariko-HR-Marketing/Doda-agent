import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db.js";
import { fail, type Env } from "../http.js";
import { appendFacts, isSensitive, listFacts, removeFact } from "../memory.js";
import { requireAuth } from "../session.js";
import { isDate, nextDue, type Repeat } from "../dates.js";

const MAX_TODOS = 200;

/** To-do ro'yxatlari: ?agent=doda (bosh agent) yoki ?agent=<agent id> */
export const todoRoutes = new Hono<Env>();
todoRoutes.use("*", requireAuth);

const dateField = z.string().refine(isDate);
const repeatField = z.enum(["none", "daily", "weekly", "monthly"]);
const createSchema = z.object({ agent: z.string().min(1).max(64).default("doda"), text: z.string().trim().min(1).max(300), priority: z.boolean().default(false), due: dateField.optional(), repeat: repeatField.default("none"), today: dateField.optional() });
const patchSchema = z.object({ done: z.boolean().optional(), text: z.string().trim().min(1).max(300).optional(), priority: z.boolean().optional(), agent: z.string().min(1).max(64).optional(), due: dateField.nullable().optional(), repeat: repeatField.optional(), today: dateField.optional() });

/** "doda" -> null (DODA ro'yxati); aks holda foydalanuvchiga tegishli agent id, yo'q bo'lsa undefined */
function scope(db: Db, userId: string, agent: string): string | null | undefined {
  if (agent === "doda") return null;
  const a = db.prepare("SELECT id FROM agents WHERE id = ? AND user_id = ?").get(agent, userId) as { id: string } | undefined;
  return a ? a.id : undefined;
}

const rowsFor = (db: Db, userId: string, agentId: string | null) =>
  (db
    .prepare(
      `SELECT id, text, done, priority, due, repeat, created_at, updated_at FROM todos WHERE user_id = ? AND ${agentId === null ? "agent_id IS NULL" : "agent_id = ?"}
       ORDER BY done, (due IS NULL), due, priority DESC, id DESC LIMIT 300`,
    )
    .all(...(agentId === null ? [userId] : [userId, agentId])) as Array<{ id: number; text: string; done: number; priority: number; due: string | null; repeat: string; created_at: number; updated_at: number }>).map((r) => ({
    id: r.id, text: r.text, done: !!r.done, priority: !!r.priority, due: r.due, repeat: r.repeat, createdAt: r.created_at, updatedAt: r.updated_at,
  }));

todoRoutes.get("/", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const sc = scope(db, user.id, c.req.query("agent") ?? "doda");
  if (sc === undefined) return fail(c, 404, "not_found");
  return c.json({ todos: rowsFor(db, user.id, sc) });
});

todoRoutes.post("/", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const sc = scope(db, user.id, body.data.agent);
  if (sc === undefined) return fail(c, 404, "not_found");
  const n = (db.prepare(`SELECT COUNT(*) n FROM todos WHERE user_id = ? AND ${sc === null ? "agent_id IS NULL" : "agent_id = ?"}`).get(...(sc === null ? [user.id] : [user.id, sc])) as { n: number }).n;
  if (n >= MAX_TODOS) return fail(c, 400, "too_many_todos");
  if (body.data.repeat !== "none" && !body.data.due) return fail(c, 400, "invalid_input"); // takrorlanish uchun muddat kerak
  db.prepare("INSERT INTO todos (user_id, agent_id, text, done, priority, due, repeat, created_at, updated_at) VALUES (?,?,?,0,?,?,?,?,?)").run(user.id, sc, body.data.text, body.data.priority ? 1 : 0, body.data.due ?? null, body.data.repeat, now(), now());
  return c.json({ todos: rowsFor(db, user.id, sc) }, 201);
});

function ownedTodo(db: Db, userId: string, id: number) {
  return db.prepare("SELECT id, agent_id FROM todos WHERE id = ? AND user_id = ?").get(id, userId) as { id: number; agent_id: string | null } | undefined;
}

todoRoutes.patch("/:id", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const t = ownedTodo(db, user.id, Number(c.req.param("id")));
  if (!t) return fail(c, 404, "not_found");
  const body = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const d = body.data;
  if (d.due !== undefined) db.prepare("UPDATE todos SET due = ?, updated_at = ? WHERE id = ?").run(d.due, now(), t.id);
  if (d.repeat !== undefined) {
    const cur = db.prepare("SELECT due FROM todos WHERE id = ?").get(t.id) as { due: string | null };
    if (d.repeat !== "none" && !cur.due) return fail(c, 400, "invalid_input");
    db.prepare("UPDATE todos SET repeat = ?, updated_at = ? WHERE id = ?").run(d.repeat, now(), t.id);
  }
  if (d.done !== undefined) {
    const prev = db.prepare("SELECT done, text, priority, due, repeat FROM todos WHERE id = ?").get(t.id) as { done: number; text: string; priority: number; due: string | null; repeat: Repeat };
    db.prepare("UPDATE todos SET done = ?, updated_at = ? WHERE id = ?").run(d.done ? 1 : 0, now(), t.id);
    // Takroriy vazifa bajarilganda keyingisi yaratiladi (muddat: bajarilgan muddatdan keyingi, lekin bugundan oldin bo'lmasin)
    if (d.done && !prev.done && prev.repeat !== "none" && prev.due) {
      let next = nextDue(prev.due, prev.repeat);
      const today = d.today ?? new Date(now()).toISOString().slice(0, 10);
      while (next <= today && next <= "9999-01-01") next = nextDue(next, prev.repeat);
      db.prepare("INSERT INTO todos (user_id, agent_id, text, done, priority, due, repeat, created_at, updated_at) VALUES (?,?,?,0,?,?,?,?,?)").run(user.id, t.agent_id, prev.text, prev.priority, next, prev.repeat, now(), now());
    }
  }
  if (d.text !== undefined) db.prepare("UPDATE todos SET text = ?, updated_at = ? WHERE id = ?").run(d.text, now(), t.id);
  if (d.priority !== undefined) db.prepare("UPDATE todos SET priority = ?, updated_at = ? WHERE id = ?").run(d.priority ? 1 : 0, now(), t.id);
  // Vazifani boshqa ro'yxatga (DODA yoki agentga) topshirish
  let owner = t.agent_id;
  if (d.agent !== undefined) {
    const target = scope(db, user.id, d.agent);
    if (target === undefined) return fail(c, 404, "not_found");
    const n = (db.prepare(`SELECT COUNT(*) n FROM todos WHERE user_id = ? AND ${target === null ? "agent_id IS NULL" : "agent_id = ?"}`).get(...(target === null ? [user.id] : [user.id, target])) as { n: number }).n;
    if (target !== t.agent_id && n >= MAX_TODOS) return fail(c, 400, "too_many_todos");
    db.prepare("UPDATE todos SET agent_id = ?, updated_at = ? WHERE id = ?").run(target, now(), t.id);
    owner = t.agent_id; // javobda hozirgi (eski) ro'yxat: vazifa undan chiqib ketadi
  }
  return c.json({ todos: rowsFor(db, user.id, owner) });
});

todoRoutes.delete("/:id", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const t = ownedTodo(db, user.id, Number(c.req.param("id")));
  if (!t) return fail(c, 404, "not_found");
  db.prepare("DELETE FROM todos WHERE id = ?").run(t.id);
  return c.json({ todos: rowsFor(db, user.id, t.agent_id) });
});

/** Bajarilganlarni tozalash */
todoRoutes.delete("/", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const sc = scope(db, user.id, c.req.query("agent") ?? "doda");
  if (sc === undefined) return fail(c, 404, "not_found");
  db.prepare(`DELETE FROM todos WHERE user_id = ? AND done = 1 AND ${sc === null ? "agent_id IS NULL" : "agent_id = ?"}`).run(...(sc === null ? [user.id] : [user.id, sc]));
  return c.json({ todos: rowsFor(db, user.id, sc) });
});

/** DODA (bosh agent) xotirasi: faktlar. Chat ham aynan shu xotiradan foydalanadi. */
export const dodaRoutes = new Hono<Env>();
dodaRoutes.use("*", requireAuth);

const factSchema = z.object({ text: z.string().trim().min(8).max(200) });

dodaRoutes.get("/memory", (c) => {
  const { db } = c.get("deps");
  return c.json({ enabled: c.get("user")!.memoryEnabled, facts: listFacts(db, c.get("user")!.id).map((text, index) => ({ index, text })) });
});

dodaRoutes.post("/memory", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const body = factSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success || isSensitive(body.data.text)) return fail(c, 400, "invalid_input");
  if (!listFacts(db, user.id).some((f) => f.toLowerCase() === body.data.text.toLowerCase())) appendFacts(db, user.id, [body.data.text], now());
  return c.json({ facts: listFacts(db, user.id).map((text, index) => ({ index, text })) }, 201);
});

dodaRoutes.delete("/memory/:index", (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  if (!removeFact(db, user.id, Number(c.req.param("index")), now())) return fail(c, 404, "not_found");
  return c.json({ facts: listFacts(db, user.id).map((text, index) => ({ index, text })) });
});
