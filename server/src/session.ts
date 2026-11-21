import type { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { fail, type Env } from "./http.js";
import { newToken, sha256 } from "./auth/tokens.js";

const DAY = 24 * 60 * 60 * 1000;

export function cookieName(isProd: boolean): string {
  // __Host- prefiksi: faqat Secure + Path=/ + Domain'siz; subdomenlardan o'g'irlab bo'lmaydi
  return isProd ? "__Host-doda_session" : "doda_session";
}

export function createSession(c: Context<Env>, userId: string): void {
  const { db, config, now } = c.get("deps");
  const token = newToken();
  const t0 = now();
  db.prepare(
    "INSERT INTO sessions (id_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?)",
  ).run(
    sha256(token),
    userId,
    t0,
    t0 + config.SESSION_TTL_DAYS * DAY,
    c.get("ip"),
    (c.req.header("user-agent") ?? "").slice(0, 300),
  );
  setCookie(c, cookieName(config.isProd), token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: config.SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export function destroySession(c: Context<Env>): void {
  const { db, config } = c.get("deps");
  const token = getCookie(c, cookieName(config.isProd));
  if (token) db.prepare("DELETE FROM sessions WHERE id_hash = ?").run(sha256(token));
  deleteCookie(c, cookieName(config.isProd), { path: "/", secure: config.isProd });
}

export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const { db, config, now } = c.get("deps");
  const token = getCookie(c, cookieName(config.isProd));
  if (!token) return fail(c, 401, "unauthorized");
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.locale, u.email_verified_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), now()) as
    | { id: string; email: string; locale: "uz" | "ru"; email_verified_at: number | null }
    | undefined;
  if (!row) return fail(c, 401, "unauthorized");
  c.set("user", {
    id: row.id,
    email: row.email,
    locale: row.locale,
    emailVerified: row.email_verified_at !== null,
  });
  await next();
};
