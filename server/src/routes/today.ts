import { Hono } from "hono";
import { fail, type Env } from "../http.js";
import { isDate } from "../dates.js";
import { requireAuth } from "../session.js";
import { usageReport } from "../usage.js";

export const todayRoutes = new Hono<Env>();
todayRoutes.use("*", requireAuth);

/** "Bugun" paneli: hamma ro'yxatlar, faol vazifalar, agentlar va oxirgi ishlar bir joyda. ?d=YYYY-MM-DD (foydalanuvchining mahalliy sanasi) */
todayRoutes.get("/", (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const dq = c.req.query("d");
  const d = dq && isDate(dq) ? dq : new Date(now()).toISOString().slice(0, 10);
  if (dq && !isDate(dq)) return fail(c, 400, "invalid_input");

  const attention = db
    .prepare(
      `SELECT t.id, t.text, t.priority, t.due, t.repeat, t.agent_id, a.name AS agent_name
       FROM todos t LEFT JOIN agents a ON a.id = t.agent_id
       WHERE t.user_id = ? AND t.done = 0 AND ((t.due IS NOT NULL AND t.due <= ?) OR t.priority = 1)
       ORDER BY (t.due IS NULL), t.due, t.priority DESC, t.id LIMIT 40`,
    )
    .all(user.id, d) as Array<{ id: number; text: string; priority: number; due: string | null; repeat: string; agent_id: string | null; agent_name: string | null }>;

  const counts = db
    .prepare(
      `SELECT SUM(done = 0) open, SUM(done = 0 AND due IS NOT NULL AND due < ?) overdue, SUM(done = 0 AND due = ?) today, SUM(done = 1) done FROM todos WHERE user_id = ?`,
    )
    .get(d, d, user.id) as { open: number | null; overdue: number | null; today: number | null; done: number | null };

  const tasks = db
    .prepare(
      `SELECT t.id, t.title, t.updated_at,
        (SELECT COUNT(*) FROM task_items WHERE task_id = t.id) total,
        (SELECT COUNT(*) FROM task_items WHERE task_id = t.id AND done = 1) done
       FROM tasks t WHERE t.user_id = ? AND t.status = 'active' ORDER BY t.updated_at DESC LIMIT 6`,
    )
    .all(user.id);

  const agents = db
    .prepare(
      `SELECT a.id, a.name, a.role,
        (SELECT COUNT(*) FROM todos WHERE agent_id = a.id AND done = 0) open_todos,
        (SELECT COUNT(*) FROM agent_memory WHERE agent_id = a.id) memory_count,
        (SELECT MAX(created_at) FROM agent_runs WHERE agent_id = a.id) last_run
       FROM agents a WHERE a.user_id = ? ORDER BY a.created_at`,
    )
    .all(user.id) as Array<{ id: string; name: string; role: string; open_todos: number; memory_count: number; last_run: number | null }>;

  const runs = db
    .prepare(
      `SELECT r.id, r.agent_id, a.name AS agent_name, r.request, r.verdict, r.model, r.cost_usd, r.created_at
       FROM agent_runs r JOIN agents a ON a.id = r.agent_id WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 8`,
    )
    .all(user.id) as Array<{ id: string; agent_id: string; agent_name: string; request: string; verdict: string; model: string; cost_usd: number; created_at: number }>;

  const usage = usageReport(db, user.id, now());
  return c.json({
    date: d,
    counts: { open: counts.open ?? 0, overdue: counts.overdue ?? 0, today: counts.today ?? 0, done: counts.done ?? 0 },
    attention: attention.map((t) => ({ id: t.id, text: t.text, priority: !!t.priority, due: t.due, repeat: t.repeat, agentId: t.agent_id, agentName: t.agent_name })),
    tasks,
    agents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role, openTodos: a.open_todos, memoryCount: a.memory_count, lastRun: a.last_run })),
    runs: runs.map((r) => ({ id: r.id, agentId: r.agent_id, agentName: r.agent_name, request: r.request.slice(0, 140), verdict: r.verdict, model: r.model, costUsd: r.cost_usd, createdAt: r.created_at })),
    usage: { monthUsd: usage.monthUsd, ownUsd: usage.ownUsd },
  });
});
