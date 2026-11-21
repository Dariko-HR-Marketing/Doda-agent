import { Hono } from "hono";
import { z } from "zod";
import { fail, userRef, type Env } from "../http.js";
import type { MessageCode } from "../i18n.js";
import { requireAuth } from "../session.js";
import { deleteFile, ensureDefaults, listFiles, listVersions, readFile, restoreVersion, WsError, writeFile } from "../workspace.js";

export const workspaceRoutes = new Hono<Env>();
workspaceRoutes.use("*", requireAuth);

const STATUS: Record<string, 400 | 404 | 409> = {
  invalid_path: 400,
  file_too_large: 400,
  too_many_files: 400,
  storage_full: 400,
  conflict: 409,
  not_found: 404,
};

function wsFail(c: Parameters<typeof fail>[0], e: unknown) {
  if (e instanceof WsError) return fail(c, STATUS[e.code] ?? 400, e.code as MessageCode);
  throw e;
}

function audit(c: { get: (k: "deps") => { db: import("../db.js").Db; now: () => number } }, userId: string, action: string): void {
  const { db, now } = c.get("deps");
  db.prepare("INSERT INTO audit_log (user_ref, action, created_at) VALUES (?,?,?)").run(userRef(userId), action, now());
}

const putSchema = z.object({ path: z.string().min(1).max(200), content: z.string().max(200_000), baseVersion: z.number().int().positive().optional() });
const restoreSchema = z.object({ path: z.string().min(1).max(200), version: z.number().int().positive() });

workspaceRoutes.get("/", (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  ensureDefaults(db, user.id, now());
  return c.json({ files: listFiles(db, user.id) });
});

workspaceRoutes.get("/file", (c) => {
  const { db } = c.get("deps");
  try {
    return c.json(readFile(db, c.get("user")!.id, c.req.query("path") ?? ""));
  } catch (e) {
    return wsFail(c, e);
  }
});

workspaceRoutes.put("/file", async (c) => {
  const { db, limiter, now } = c.get("deps");
  const user = c.get("user")!;
  if (!limiter.take(`ws:${user.id}`, 60, 60_000)) return fail(c, 429, "too_many_requests");
  const body = putSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  try {
    const r = writeFile(db, user.id, body.data.path, body.data.content, "user", now(), body.data.baseVersion);
    if (r.changed) audit(c, user.id, "workspace_write");
    return c.json(r);
  } catch (e) {
    return wsFail(c, e);
  }
});

workspaceRoutes.delete("/file", (c) => {
  const { db } = c.get("deps");
  const user = c.get("user")!;
  try {
    deleteFile(db, user.id, c.req.query("path") ?? "");
    audit(c, user.id, "workspace_delete");
    return c.json({ status: "deleted" });
  } catch (e) {
    return wsFail(c, e);
  }
});

workspaceRoutes.get("/versions", (c) => {
  const { db } = c.get("deps");
  try {
    return c.json({ versions: listVersions(db, c.get("user")!.id, c.req.query("path") ?? "") });
  } catch (e) {
    return wsFail(c, e);
  }
});

workspaceRoutes.post("/restore", async (c) => {
  const { db, now } = c.get("deps");
  const user = c.get("user")!;
  const body = restoreSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  try {
    const r = restoreVersion(db, user.id, body.data.path, body.data.version, now());
    audit(c, user.id, "workspace_restore");
    return c.json(r);
  } catch (e) {
    return wsFail(c, e);
  }
});
