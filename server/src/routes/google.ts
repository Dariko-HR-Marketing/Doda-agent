import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { REQUIRED_CONSENTS, recordConsent } from "../consents.js";
import { newToken, sha256 } from "../auth/tokens.js";
import { fail, userRef, type Env } from "../http.js";
import { createSession } from "../session.js";

export const googleRoutes = new Hono<Env>();

const startSchema = z.object({
  locale: z.enum(["uz", "ru"]).default("uz"),
  /** Yangi foydalanuvchi uchun majburiy; kirayotgan mavjud foydalanuvchi uchun shart emas */
  consents: z
    .object({ terms: z.boolean(), personalData: z.boolean(), crossBorder: z.boolean(), voice: z.boolean().default(false) })
    .optional(),
});

function stateCookie(isProd: boolean): string {
  return isProd ? "__Host-doda_oauth" : "doda_oauth";
}

googleRoutes.post("/start", async (c) => {
  const { db, config, google, limiter, now } = c.get("deps");
  if (!google) return fail(c, 404, "not_found");
  if (!limiter.take(`gstart:${c.get("ip")}`, 30, 60 * 60 * 1000)) return fail(c, 429, "too_many_requests");

  const body = startSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return fail(c, 400, "invalid_input");

  const state = newToken();
  const verifier = newToken();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  db.prepare("INSERT INTO oauth_states (state_hash, verifier, consents, locale, expires_at) VALUES (?,?,?,?,?)").run(
    sha256(state),
    verifier,
    body.data.consents ? JSON.stringify(body.data.consents) : null,
    body.data.locale,
    now() + 10 * 60 * 1000,
  );
  setCookie(c, stateCookie(config.isProd), state, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });
  return c.json({ url: google.authUrl({ state, challenge }) });
});

googleRoutes.get("/callback", async (c) => {
  const { db, config, google, now } = c.get("deps");
  const back = (path: string) => c.redirect(`${config.APP_ORIGIN}/#/auth/${path}`, 302);
  if (!google) return fail(c, 404, "not_found");

  const cookieName = stateCookie(config.isProd);
  const cookieState = getCookie(c, cookieName);
  deleteCookie(c, cookieName, { path: "/", secure: config.isProd });
  const state = c.req.query("state");
  const code = c.req.query("code");

  if (!state || !cookieState || state !== cookieState) return back("error?code=state_invalid");
  const row = db
    .prepare("SELECT verifier, consents, locale FROM oauth_states WHERE state_hash = ? AND expires_at > ?")
    .get(sha256(state), now()) as { verifier: string; consents: string | null; locale: "uz" | "ru" } | undefined;
  db.prepare("DELETE FROM oauth_states WHERE state_hash = ?").run(sha256(state)); // bir martalik
  if (!row) return back("error?code=state_invalid");
  if (c.req.query("error") || !code) return back("error?code=google_cancelled");

  let profile;
  try {
    profile = await google.exchange({ code, verifier: row.verifier });
  } catch (e) {
    console.error("[google]", e instanceof Error ? e.message : e);
    return back("error?code=google_failed");
  }
  if (!profile.emailVerified) return back("error?code=email_unverified");

  const email = profile.email.trim().toLowerCase();
  const t0 = now();
  const ua = c.req.header("user-agent") ?? "";
  const ip = c.get("ip");
  type U = { id: string; google_sub: string | null; email_verified_at: number | null; password_hash: string | null };

  let user = db.prepare("SELECT id, google_sub, email_verified_at, password_hash FROM users WHERE google_sub = ?").get(profile.sub) as U | undefined;
  if (!user) {
    user = db.prepare("SELECT id, google_sub, email_verified_at, password_hash FROM users WHERE email = ?").get(email) as U | undefined;
    if (user) {
      if (user.google_sub && user.google_sub !== profile.sub) return back("error?code=google_failed");
      // Tasdiqlanmagan parolli akkaunt bo'lsa: kimdir egasiz email bilan oldindan ro'yxatdan o'tgan bo'lishi mumkin.
      // Google email egaligini tasdiqlaganini hisobga olib, eski parolni bekor qilamiz.
      const clearPassword = user.email_verified_at === null;
      db.prepare(
        "UPDATE users SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, ?), password_hash = CASE WHEN ? THEN NULL ELSE password_hash END WHERE id = ?",
      ).run(profile.sub, t0, clearPassword ? 1 : 0, user.id);
      if (clearPassword) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    }
  }

  if (!user) {
    // Yangi foydalanuvchi: rozilik shart
    let consents: { terms: boolean; personalData: boolean; crossBorder: boolean; voice: boolean } | null = null;
    try {
      consents = row.consents ? JSON.parse(row.consents) : null;
    } catch {
      consents = null;
    }
    if (!consents || !(consents.terms && consents.personalData && consents.crossBorder)) {
      return back("error?code=consent_required");
    }
    const id = randomUUID();
    db.transaction(() => {
      db.prepare("INSERT INTO users (id, email, google_sub, email_verified_at, locale, created_at) VALUES (?,?,?,?,?,?)").run(
        id,
        email,
        profile.sub,
        t0,
        row.locale,
        t0,
      );
      const base = { userId: id, version: config.LEGAL_VERSION, ip, userAgent: ua, at: t0 };
      for (const type of REQUIRED_CONSENTS) recordConsent(db, { ...base, type, accepted: true });
      recordConsent(db, { ...base, type: "voice", accepted: consents!.voice === true });
      db.prepare("INSERT INTO audit_log (user_ref, action, meta, created_at) VALUES (?,?,?,?)").run(
        userRef(id),
        "register_google",
        JSON.stringify({ legal: config.LEGAL_VERSION }),
        t0,
      );
    })();
    user = { id, google_sub: profile.sub, email_verified_at: t0, password_hash: null };
  }

  createSession(c, user.id);
  db.prepare("INSERT INTO audit_log (user_ref, action, created_at) VALUES (?,?,?)").run(userRef(user.id), "login_google", t0);
  return back("done");
});
