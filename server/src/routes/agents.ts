import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db.js";
import { agentSystem, buildBrief, type AgentContext, parseReview, REVIEW_SYSTEM, TEMPLATES, templateById, type TaskContext } from "../agents.js";
import { fail, type Env } from "../http.js";
import { recordUsage, sharedSpendUsd } from "../usage.js";
import { ChainError, chainFor, legacyChain, runChain } from "../llm/multi.js";
import { requireAuth } from "../session.js";
import { monthStartUtc } from "../usage.js";
import { routeRequest } from "../agentRouter.js";
import { catalogFor, localized, recommendedIds, selectableIds, suggestTemplate, type CatItem } from "../catalog.js";
import { isSensitive } from "../memory.js";

export const agentRoutes = new Hono<Env>();
agentRoutes.use("*", requireAuth);

const MAX_AGENTS = 20;
const MAX_RUNS_KEPT = 50;
const MIN = 60_000;

const idList = z.array(z.string().min(1).max(40)).max(80);
const customList = z.array(z.object({ group: z.enum(["duties", "tools", "situations"]), text: z.string().trim().min(1).max(200) })).max(30);
const createSchema = z.union([
  z.object({ template: z.string().min(1).max(40), name: z.string().trim().min(1).max(60).optional(), capabilities: idList.optional(), custom: customList.optional() }),
  z.object({ name: z.string().trim().min(1).max(60), role: z.string().trim().min(1).max(200), instructions: z.string().trim().min(1).max(3000), capabilities: idList.optional(), custom: customList.optional() }),
]);
const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  role: z.string().trim().min(1).max(200).optional(),
  instructions: z.string().trim().min(1).max(3000).optional(),
  capabilities: idList.optional(),
  custom: customList.optional(),
});
const memorySchema = z.object({ kind: z.enum(["fact", "lesson", "preference"]).default("fact"), text: z.string().trim().min(3).max(300) });
const runSchema = z.object({ request: z.string().trim().min(3).max(6000), taskId: z.string().max(64).optional(), tier: z.enum(["light", "main"]).default("main") });

interface AgentRow { id: string; template: string | null; name: string; role: string; instructions: string; capabilities: string; custom_items: string; created_at: number }
const parse = <T,>(raw: string, d: T): T => { try { return JSON.parse(raw) as T; } catch { return d; } };
const view = (a: AgentRow, extra: object = {}) => ({
  id: a.id, template: a.template, name: a.name, role: a.role, instructions: a.instructions, createdAt: a.created_at,
  capabilities: parse<string[]>(a.capabilities, []), custom: parse<Array<{ group: string; text: string }>>(a.custom_items, []), ...extra,
});
const owned = (db: Db, userId: string, id: string) => db.prepare("SELECT * FROM agents WHERE id = ? AND user_id = ?").get(id, userId) as AgentRow | undefined;
const counts = (db: Db, userId: string, id: string, now: number) => ({
  ...(() => {
    const r = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(cost_usd),0) usd FROM agent_runs WHERE agent_id = ? AND user_id = ? AND created_at >= ?").get(id, userId, monthStartUtc(now)) as { n: number; usd: number };
    return { runsMonth: r.n, costMonthUsd: r.usd };
  })(),
  openTodos: (db.prepare("SELECT COUNT(*) n FROM todos WHERE user_id = ? AND agent_id = ? AND done = 0").get(userId, id) as { n: number }).n,
  memoryCount: (db.prepare("SELECT COUNT(*) n FROM agent_memory WHERE agent_id = ?").get(id) as { n: number }).n,
});

/** Tanlangan id lar katalogda bormi va tanlab bo'ladimi? */
function checkCaps(template: string | null, ids: string[]): boolean {
  const cat = catalogFor(template);
  const ok = selectableIds(cat);
  return ids.every((x) => ok.has(x)) && new Set(ids).size === ids.length;
}

agentRoutes.get("/", (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const rows = db.prepare("SELECT * FROM agents WHERE user_id = ? ORDER BY created_at").all(user.id) as AgentRow[];
  return c.json({
    agents: rows.map((r) => view(r, counts(db, user.id, r.id, now()))),
    templates: TEMPLATES.map((t) => ({ id: t.id, uz: t.uz, ru: t.ru })),
  });
});

/** DODA tavsiyasi: rol uchun vazifalar, vositalar va holatlar ro'yxati (tavsiya etilganlari oldindan belgilangan) */
agentRoutes.get("/catalog", (c) => {
  const user = c.get("user")!;
  const q = c.req.query("q") ?? "";
  const requested = c.req.query("template") ?? "";
  const template = requested || suggestTemplate(q);
  const cat = catalogFor(template);
  return c.json({ template: cat.id, suggested: !requested, catalog: localized(cat, user.locale === "ru" ? "ru" : "uz"), recommended: recommendedIds(cat) });
});

/** DODA marshrutizatori: topshiriqni qaysi agentga berish kerak (AI siz, qoidalar bo'yicha) */
agentRoutes.post("/route", async (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const body = z.object({ text: z.string().trim().min(3).max(2000) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const rows = db.prepare("SELECT * FROM agents WHERE user_id = ? ORDER BY created_at").all(user.id) as AgentRow[];
  const route = routeRequest(body.data.text, rows.map((r) => ({ id: r.id, template: r.template, name: r.name, role: r.role, capabilities: parse<string[]>(r.capabilities, []), custom: parse(r.custom_items, []) })));
  return c.json(route);
});

agentRoutes.post("/", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const n = (db.prepare("SELECT COUNT(*) n FROM agents WHERE user_id = ?").get(user.id) as { n: number }).n;
  if (n >= MAX_AGENTS) return fail(c, 400, "too_many_agents");
  let rec: { template: string | null; name: string; role: string; instructions: string };
  const catTemplate = "template" in body.data ? body.data.template : null;
  if ("template" in body.data) {
    const t = templateById(body.data.template);
    if (!t) return fail(c, 400, "invalid_input");
    const l = user.locale === "ru" ? t.ru : t.uz;
    rec = { template: t.id, name: body.data.name ?? l.name, role: l.role, instructions: t.instructions };
  } else {
    rec = { template: null, name: body.data.name, role: body.data.role, instructions: body.data.instructions };
  }
  // Imkoniyatlar: berilmasa DODA tavsiyasi (tavsiya etilganlar) qo'llanadi
  const caps = body.data.capabilities ?? recommendedIds(catalogFor(catTemplate));
  if (!checkCaps(catTemplate, caps)) return fail(c, 400, "invalid_input");
  const custom = body.data.custom ?? [];
  if (custom.some((x) => isSensitive(x.text))) return fail(c, 400, "invalid_input");
  const id = randomUUID();
  db.prepare("INSERT INTO agents (id, user_id, template, name, role, instructions, capabilities, custom_items, created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(
    id, user.id, rec.template, rec.name, rec.role, rec.instructions, JSON.stringify(caps), JSON.stringify(custom), now(),
  );
  return c.json({ agent: view(owned(db, user.id, id)!, counts(db, user.id, id, now())) }, 201);
});

agentRoutes.patch("/:id", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const a = owned(db, user.id, c.req.param("id"));
  if (!a) return fail(c, 404, "not_found");
  const body = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const d = body.data;
  if (d.capabilities && !checkCaps(a.template, d.capabilities)) return fail(c, 400, "invalid_input");
  if (d.custom && d.custom.some((x) => isSensitive(x.text))) return fail(c, 400, "invalid_input");
  db.prepare("UPDATE agents SET name = ?, role = ?, instructions = ?, capabilities = ?, custom_items = ? WHERE id = ?").run(
    d.name ?? a.name, d.role ?? a.role, d.instructions ?? a.instructions,
    d.capabilities ? JSON.stringify(d.capabilities) : a.capabilities, d.custom ? JSON.stringify(d.custom) : a.custom_items, a.id,
  );
  return c.json({ agent: view(owned(db, user.id, a.id)!, counts(db, user.id, a.id, now())) });
});

/** Agentning shaxsiy xotirasi */
const MAX_MEMORY = 100;
agentRoutes.get("/:id/memory", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const a = owned(db, user.id, c.req.param("id"));
  if (!a) return fail(c, 404, "not_found");
  const rows = db.prepare("SELECT id, kind, text, created_at FROM agent_memory WHERE agent_id = ? ORDER BY id DESC").all(a.id) as Array<{ id: number; kind: string; text: string; created_at: number }>;
  return c.json({ memory: rows.map((r) => ({ id: r.id, kind: r.kind, text: r.text, createdAt: r.created_at })) });
});

agentRoutes.post("/:id/memory", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const a = owned(db, user.id, c.req.param("id"));
  if (!a) return fail(c, 404, "not_found");
  const body = memorySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success || isSensitive(body.data.text)) return fail(c, 400, "invalid_input");
  const n = (db.prepare("SELECT COUNT(*) n FROM agent_memory WHERE agent_id = ?").get(a.id) as { n: number }).n;
  if (n >= MAX_MEMORY) return fail(c, 400, "too_many_memory");
  const dup = db.prepare("SELECT 1 FROM agent_memory WHERE agent_id = ? AND lower(text) = lower(?)").get(a.id, body.data.text);
  if (!dup) db.prepare("INSERT INTO agent_memory (agent_id, user_id, kind, text, created_at) VALUES (?,?,?,?,?)").run(a.id, user.id, body.data.kind, body.data.text, now());
  return c.json({ ok: true }, 201);
});

agentRoutes.delete("/:id/memory/:mid", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  const a = owned(db, user.id, c.req.param("id"));
  if (!a) return fail(c, 404, "not_found");
  const r = db.prepare("DELETE FROM agent_memory WHERE id = ? AND agent_id = ?").run(Number(c.req.param("mid")), a.id);
  return r.changes ? c.json({ ok: true }) : fail(c, 404, "not_found");
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
  const { db, config, limiter, now, llmFor } = c.get("deps");
  const user = c.get("user")!;
  const resolved = llmFor(user.id);
  if (!resolved) return fail(c, 403, "api_key_required");
  const { llm, own } = resolved;
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
  if (!own && sharedSpendUsd(db, user.id, now()) >= config.MONTHLY_BUDGET_USD) return fail(c, 429, "budget_exceeded");

  const env = { llm, legacy: legacyChain(config) };
  const ctx = agentContext(db, user.id, a);
  const brief = buildBrief(body.data.request, task);
  const record = (m: string, tin: number, tout: number) => recordUsage(db, { userId: user.id, model: m, tokensIn: tin, tokensOut: tout, own, now: now() });

  let work;
  let model = "";
  try {
    const out = await runChain(chainFor(env, body.data.tier === "light" ? "light" : "main"), (m) => llm.complete({ model: m, system: agentSystem(a, ctx), messages: [{ role: "user", content: brief }] }));
    work = out.result;
    model = out.model;
  } catch (e) {
    return fail(c, e instanceof ChainError && e.code === "llm_rate_limited" ? 429 : 503, e instanceof ChainError ? e.code : "llm_unavailable");
  }
  let cost = record(model, work.tokensIn, work.tokensOut);
  const result = work.text.trim();
  if (!result) return fail(c, 503, "agent_empty");

  // Tekshiruv: arzon model bilan. Xato bo'lsa ish saqlanadi, "tekshirilmadi" deb belgilanadi.
  let review = { verdict: "unchecked" as "ok" | "needs_work" | "unchecked", notes: "" };
  try {
    const rv = await runChain(chainFor(env, "light"), (m) =>
      llm.complete({
        model: m,
        system: REVIEW_SYSTEM,
        messages: [{ role: "user", content: `BRIEF:\n"""${brief}"""\n\nAGENT NATIJASI:\n"""${result.slice(0, 12000)}"""` }],
        json: true,
      }),
    );
    cost += record(rv.model, rv.result.tokensIn, rv.result.tokensOut);
    review = parseReview(rv.result.text);
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


/** Agent uchun kontekst: tanlangan imkoniyatlar, shaxsiy xotira, ochiq to-do. Boshqa agentlarniki KIRMAYDI. */
function agentContext(db: Db, userId: string, a: AgentRow): AgentContext {
  const cat = catalogFor(a.template);
  const chosen = new Set(parse<string[]>(a.capabilities, []));
  const pick = (g: string): string[] => cat.groups.find((x) => x.id === g)!.items.filter((i: CatItem) => chosen.has(i.id)).map((i) => i.label.uz);
  const custom = parse<Array<{ group: string; text: string }>>(a.custom_items, []);
  const memory = db.prepare("SELECT kind, text FROM agent_memory WHERE agent_id = ? ORDER BY id DESC LIMIT 40").all(a.id) as Array<{ kind: string; text: string }>;
  const todos = (db.prepare("SELECT text FROM todos WHERE user_id = ? AND agent_id = ? AND done = 0 ORDER BY priority DESC, id LIMIT 15").all(userId, a.id) as Array<{ text: string }>).map((t) => t.text);
  return {
    duties: [...pick("duties"), ...custom.filter((x) => x.group === "duties").map((x) => x.text)],
    tools: [...pick("tools"), ...custom.filter((x) => x.group === "tools").map((x) => x.text)],
    situations: [...pick("situations"), ...custom.filter((x) => x.group === "situations").map((x) => x.text)],
    custom: [],
    memory,
    todos,
  };
}
