import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db.js";
import { agentSystem, buildBrief, parseReview, REVIEW_SYSTEM, TEMPLATES, templateById, type TaskContext } from "../agents.js";
import { fail, type Env } from "../http.js";
import { costUsd } from "../llm/pricing.js";
import { LlmHttpError } from "../llm/types.js";
import { requireAuth } from "../session.js";

export const agentRoutes = new Hono<Env>();
agentRoutes.use("*", requireAuth);

const MAX_AGENTS = 20;
const MAX_RUNS_KEPT = 50;
const MIN = 60_000;

const createSchema = z.union([
  z.object({ template: z.string().min(1).max(40) }),
  z.object({ name: z.string().trim().min(1).max(60), role: z.string().trim().min(1).max(200), instructions: z.string().trim().min(1).max(3000) }),
]);
const patchSchema = z.object({ name: z.string().trim().min(1).max(60).optional(), role: z.string().trim().min(1).max(200).optional(), instructions: z.string().trim().min(1).max(3000).optional() });
const runSchema = z.object({ request: z.string().trim().min(3).max(6000), taskId: z.string().max(64).optional(), tier: z.enum(["light", "main"]).default("main") });

interface AgentRow { id: string; template: string | null; name: string; role: string; instructions: string; created_at: number }
const view = (a: AgentRow) => ({ id: a.id, template: a.template, name: a.name, role: a.role, instructions: a.instructions, createdAt: a.created_at });
const owned = (db: Db, userId: string, id: string) => db.prepare("SELECT * FROM agents WHERE id = ? AND user_id = ?").get(id, userId) as AgentRow | undefined;

agentRoutes.get("/", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const rows = db.prepare("SELECT * FROM agents WHERE user_id = ? ORDER BY created_at").all(user.id) as AgentRow[];
  return c.json({
    agents: rows.map(view),
    templates: TEMPLATES.map((t) => ({ id: t.id, uz: t.uz, ru: t.ru })),
  });
});

agentRoutes.post("/", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const n = (db.prepare("SELECT COUNT(*) n FROM agents WHERE user_id = ?").get(user.id) as { n: number }).n;
  if (n >= MAX_AGENTS) return fail(c, 400, "too_many_agents");
  let rec: { template: string | null; name: string; role: string; instructions: string };
  if ("template" in body.data) {
    const t = templateById(body.data.template);
    if (!t) return fail(c, 400, "invalid_input");
    const l = user.locale === "ru" ? t.ru : t.uz;
    rec = { template: t.id, name: l.name, role: l.role, instructions: t.instructions };
  } else {
    rec = { template: null, ...body.data };
  }
  const id = randomUUID();
  db.prepare("INSERT INTO agents (id, user_id, template, name, role, instructions, created_at) VALUES (?,?,?,?,?,?,?)").run(id, user.id, rec.template, rec.name, rec.role, rec.instructions, now());
  return c.json({ agent: view(owned(db, user.id, id)!) }, 201);
});

agentRoutes.patch("/:id", async (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const a = owned(db, user.id, c.req.param("id"));
  if (!a) return fail(c, 404, "not_found");
  const body = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const d = body.data;
  db.prepare("UPDATE agents SET name = ?, role = ?, instructions = ? WHERE id = ?").run(d.name ?? a.name, d.role ?? a.role, d.instructions ?? a.instructions, a.id);
  return c.json({ agent: view(owned(db, user.id, a.id)!) });
});

agentRoutes.delete("/:id", (c) => {
  const { db } = c.get("deps");
  const r = db.prepare("DELETE FROM agents WHERE id = ? AND user_id = ?").run(c.req.param("id"), c.get("user")!.id);
  return r.changes ? c.json({ ok: true }) : fail(c, 404, "not_found");
});

interface RunRow { id: string; task_id: string | null; request: string; result: string; verdict: string; review: string; model: string; cost_usd: number; created_at: number }
const runView = (r: RunRow) => ({ id: r.id, taskId: r.task_id, request: r.request, result: r.result, verdict: r.verdict, review: r.review, model: r.model, costUsd: r.cost_usd, createdAt: r.created_at });

agentRoutes.get("/:id/runs", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const a = owned(db, user.id, c.req.param("id"));
  if (!a) return fail(c, 404, "not_found");
  const rows = db.prepare("SELECT * FROM agent_runs WHERE agent_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?").all(a.id, user.id, MAX_RUNS_KEPT) as RunRow[];
  return c.json({ runs: rows.map(runView) });
});

function loadTask(db: Db, userId: string, id: string): TaskContext | null {
  const t = db.prepare("SELECT id, title, goal FROM tasks WHERE id = ? AND user_id = ?").get(id, userId) as { id: string; title: string; goal: string } | undefined;
  if (!t) return null;
  const stages = db.prepare("SELECT stage, name FROM task_stages WHERE task_id = ? ORDER BY stage").all(id) as Array<{ stage: number; name: string }>;
  const items = db.prepare("SELECT stage, text, done FROM task_items WHERE task_id = ? ORDER BY stage, position, id").all(id) as Array<{ stage: number; text: string; done: number }>;
  return { title: t.title, goal: t.goal, stages: stages.map((s) => ({ name: s.name, items: items.filter((i) => i.stage === s.stage).map((i) => ({ text: i.text, done: !!i.done })) })) };
}

/** DODA topshiriq beradi -> agent bajaradi -> DODA tekshiradi. Agent faqat brief va o'z ko'rsatmasini ko'radi. */
agentRoutes.post("/:id/run", async (c) => {
  const { db, config, llm, limiter, now } = c.get("deps");
  const user = c.get("user")!;
  if (!llm) return fail(c, 503, "llm_unavailable");
  const a = owned(db, user.id, c.req.param("id"));
  if (!a) return fail(c, 404, "not_found");
  if (!limiter.take(`agent:${user.id}`, 10, 10 * MIN)) return fail(c, 429, "too_many_requests");
  const body = runSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");

  let task: TaskContext | null = null;
  if (body.data.taskId) {
    task = loadTask(db, user.id, body.data.taskId);
    if (!task) return fail(c, 404, "not_found");
  }
  const d = new Date(now());
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const spent = (db.prepare("SELECT COALESCE(SUM(cost_usd),0) usd FROM usage WHERE user_id = ? AND created_at >= ?").get(user.id, monthStart) as { usd: number }).usd;
  if (spent >= config.MONTHLY_BUDGET_USD) return fail(c, 429, "budget_exceeded");

  let model = body.data.tier === "light" ? config.GEMINI_MODEL_LIGHT : config.GEMINI_MODEL_MAIN;
  const brief = buildBrief(body.data.request, task);
  const record = (m: string, tin: number, tout: number) => {
    const cost = costUsd(m, tin, tout, now());
    db.prepare("INSERT INTO usage (user_id, conversation_id, model, tokens_in, tokens_out, cost_usd, created_at) VALUES (?,?,?,?,?,?,?)").run(user.id, null, m, tin, tout, cost, now());
    return cost;
  };

  let work;
  try {
    try {
      work = await llm.complete({ model, system: agentSystem(a), messages: [{ role: "user", content: brief }] });
    } catch (e) {
      // Asosiy model band yoki yopiq bo'lsa, arzon modelga o'tamiz
      if (model === config.GEMINI_MODEL_LIGHT) throw e;
      model = config.GEMINI_MODEL_LIGHT;
      work = await llm.complete({ model, system: agentSystem(a), messages: [{ role: "user", content: brief }] });
    }
  } catch (e) {
    if (e instanceof LlmHttpError && e.status === 429) return fail(c, 429, "llm_rate_limited");
    return fail(c, 503, "llm_unavailable");
  }
  let cost = record(model, work.tokensIn, work.tokensOut);
  const result = work.text.trim();
  if (!result) return fail(c, 503, "agent_empty");

  // Tekshiruv: arzon model bilan. Xato bo'lsa ish saqlanadi, "tekshirilmadi" deb belgilanadi.
  let review = { verdict: "unchecked" as "ok" | "needs_work" | "unchecked", notes: "" };
  try {
    const rv = await llm.complete({
      model: config.GEMINI_MODEL_LIGHT,
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: `BRIEF:\n"""${brief}"""\n\nAGENT NATIJASI:\n"""${result.slice(0, 12000)}"""` }],
      json: true,
    });
    cost += record(config.GEMINI_MODEL_LIGHT, rv.tokensIn, rv.tokensOut);
    review = parseReview(rv.text);
  } catch { /* tekshiruv ixtiyoriy */ }

  const id = randomUUID();
  db.prepare("INSERT INTO agent_runs (id, agent_id, user_id, task_id, request, brief, result, verdict, review, model, cost_usd, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(
    id, a.id, user.id, body.data.taskId ?? null, body.data.request, brief, result, review.verdict, review.notes, model, cost, now(),
  );
  // Eski yozuvlarni kesish
  db.prepare("DELETE FROM agent_runs WHERE agent_id = ? AND id NOT IN (SELECT id FROM agent_runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?)").run(a.id, a.id, MAX_RUNS_KEPT);
  const row = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as RunRow;
  return c.json({ run: runView(row) }, 201);
});
