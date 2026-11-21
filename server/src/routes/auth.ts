import { Hono } from "hono";
import { z } from "zod";
import { REQUIRED_CONSENTS, recordConsent } from "../consents.js";
import { burnPasswordTime, hashPassword, verifyPassword } from "../auth/password.js";
import { newToken, sha256 } from "../auth/tokens.js";
import { fail, userRef, type Env } from "../http.js";
import { t } from "../i18n.js";
import { createSession, destroySession, requireAuth } from "../session.js";
import { currentConsents } from "../consents.js";
import { randomUUID } from "node:crypto";
import { trySend } from "../mailer.js";

export const authRoutes = new Hono<Env>();

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
  locale: z.enum(["uz", "ru"]).default("uz"),
  consents: z.object({
    terms: z.boolean(),
    personalData: z.boolean(),
    crossBorder: z.boolean(),
    voice: z.boolean().default(false),
  }),
});

const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) });
const verifySchema = z.object({ token: z.string().min(10).max(200) });

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

function audit(c: { get: (k: "deps") => { db: import("../db.js").Db; now: () => number } }, userId: string | null, action: string, meta?: object): void {
  const { db, now } = c.get("deps");
  db.prepare("INSERT INTO audit_log (user_ref, action, meta, created_at) VALUES (?,?,?,?)").run(
    userId ? userRef(userId) : null,
    action,
    meta ? JSON.stringify(meta) : null,
    now(),
  );
}

authRoutes.post("/register", async (c) => {
  const { db, config, mailer, limiter, now } = c.get("deps");
  const ip = c.get("ip");
  if (!limiter.take(`reg:${ip}`, 10, HOUR)) return fail(c, 429, "too_many_requests");

  const body = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const { password, locale, consents } = body.data;
  const email = normEmail(body.data.email);

  if (!(consents.terms && consents.personalData && consents.crossBorder)) {
    return fail(c, 400, "consent_required");
  }
  if (password.length < 10 || password.toLowerCase() === email) return fail(c, 400, "weak_password");

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
  const generic = { status: "check_email", message: t("check_email", locale) };

  if (existing) {
    // Email mavjudligini oshkor qilmaymiz: bir xil javob va bir xil sarflangan vaqt
    await burnPasswordTime(password);
    await trySend(mailer, {
      to: email,
      subject: locale === "ru" ? "DODA: аккаунт уже существует" : "DODA: akkaunt allaqachon mavjud",
      text:
        locale === "ru"
          ? "Для этого адреса уже есть аккаунт. Если это были вы, просто войдите. Если нет, проигнорируйте письмо."
          : "Bu pochta uchun akkaunt allaqachon mavjud. Agar bu siz bo'lsangiz, tizimga kiring. Aks holda xatni e'tiborsiz qoldiring.",
    });
    return c.json(generic, 202);
  }

  const id = randomUUID();
  const t0 = now();
  const hash = await hashPassword(password);
  const token = newToken();
  const ua = c.req.header("user-agent") ?? "";

  try {
    db.transaction(() => {
      db.prepare("INSERT INTO users (id, email, password_hash, locale, created_at) VALUES (?,?,?,?,?)").run(
        id,
        email,
        hash,
        locale,
        t0,
      );
      const base = { userId: id, version: config.LEGAL_VERSION, ip, userAgent: ua, at: t0 };
      for (const type of REQUIRED_CONSENTS) recordConsent(db, { ...base, type, accepted: true });
      recordConsent(db, { ...base, type: "voice", accepted: consents.voice });
      db.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at) VALUES (?,?,?,?)").run(
        sha256(token),
        id,
        "verify_email",
        t0 + 24 * HOUR,
      );
    })();
  } catch (e) {
    // Parallel ro'yxatdan o'tishda UNIQUE buzilishi: yana bir xil javob
    if (e instanceof Error && /UNIQUE/.test(e.message)) return c.json(generic, 202);
    throw e;
  }

  audit(c, id, "register", { legal: config.LEGAL_VERSION });
  const link = `${config.APP_ORIGIN}/#/verify?token=${token}`;
  await trySend(mailer, {
    to: email,
    subject: locale === "ru" ? "DODA: подтвердите почту" : "DODA: pochtangizni tasdiqlang",
    text:
      locale === "ru"
        ? `Подтвердите адрес по ссылке (действует 24 часа):\n${link}`
        : `Pochtangizni quyidagi havola orqali tasdiqlang (24 soat amal qiladi):\n${link}`,
  });
  return c.json(generic, 202);
});

authRoutes.post("/verify-email", async (c) => {
  const { db, now, limiter } = c.get("deps");
  if (!limiter.take(`ver:${c.get("ip")}`, 30, HOUR)) return fail(c, 429, "too_many_requests");
  const body = verifySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");

  const t0 = now();
  const row = db
    .prepare(
      "SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > ?",
    )
    .get(sha256(body.data.token), t0) as { user_id: string } | undefined;
  if (!row) return fail(c, 400, "invalid_token");

  db.transaction(() => {
    db.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?").run(t0, sha256(body.data.token));
    db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(t0, row.user_id);
  })();
  audit(c, row.user_id, "verify_email");
  return c.json({ status: "verified" });
});

authRoutes.post("/login", async (c) => {
  const { db, limiter } = c.get("deps");
  const ip = c.get("ip");
  if (!limiter.take(`login-ip:${ip}`, 30, 10 * MIN)) return fail(c, 429, "too_many_requests");

  const body = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const email = normEmail(body.data.email);
  // Egasini qulflab qo'ymaslik uchun: asosiy cheklov email+IP bo'yicha, umumiy cheklov yuqoriroq
  if (!limiter.take(`login-email-ip:${email}:${ip}`, 8, 10 * MIN)) return fail(c, 429, "too_many_requests");
  if (!limiter.take(`login-email-all:${email}`, 60, HOUR)) return fail(c, 429, "too_many_requests");

  const user = db
    .prepare("SELECT id, email, password_hash, locale, email_verified_at FROM users WHERE email = ?")
    .get(email) as
    | { id: string; email: string; password_hash: string | null; locale: "uz" | "ru"; email_verified_at: number | null }
    | undefined;

  if (!user || !user.password_hash) {
    await burnPasswordTime(body.data.password);
    return fail(c, 401, "invalid_credentials");
  }
  if (!(await verifyPassword(body.data.password, user.password_hash))) {
    audit(c, user.id, "login_failed");
    return fail(c, 401, "invalid_credentials");
  }
  if (user.email_verified_at === null) return fail(c, 403, "email_not_verified");

  createSession(c, user.id);
  audit(c, user.id, "login");
  return c.json({ user: { id: user.id, email: user.email, locale: user.locale, emailVerified: true } });
});

authRoutes.post("/logout", async (c) => {
  destroySession(c);
  return c.json({ status: "ok" });
});

authRoutes.get("/me", requireAuth, (c) => {
  const user = c.get("user")!;
  return c.json({ user, consents: currentConsents(c.get("deps").db, user.id) });
});

const emailOnly = z.object({ email: z.email().max(254) });
const resetSchema = z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(128) });

function mailTexts(locale: "uz" | "ru", kind: "verify" | "reset", link: string): { subject: string; text: string } {
  if (kind === "verify") {
    return locale === "ru"
      ? { subject: "DODA: подтвердите почту", text: `Подтвердите адрес по ссылке (действует 24 часа):\n${link}` }
      : { subject: "DODA: pochtangizni tasdiqlang", text: `Pochtangizni quyidagi havola orqali tasdiqlang (24 soat amal qiladi):\n${link}` };
  }
  return locale === "ru"
    ? { subject: "DODA: восстановление пароля", text: `Задайте новый пароль по ссылке (действует 1 час). Если вы не запрашивали это, проигнорируйте письмо.\n${link}` }
    : { subject: "DODA: parolni tiklash", text: `Yangi parol o'rnatish uchun havola (1 soat amal qiladi). Agar bu so'rovni siz yubormagan bo'lsangiz, xatni e'tiborsiz qoldiring.\n${link}` };
}

/** Bir xil javob: email mavjudligi oshkor bo'lmaydi */
authRoutes.post("/resend-verification", async (c) => {
  const { db, config, mailer, limiter, now } = c.get("deps");
  if (!limiter.take(`resend-ip:${c.get("ip")}`, 10, HOUR)) return fail(c, 429, "too_many_requests");
  const body = emailOnly.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const email = normEmail(body.data.email);
  const generic = { status: "check_email", message: t("check_email", c.get("locale")) };
  if (!limiter.take(`resend-email:${email}`, 3, HOUR)) return c.json(generic, 202);

  const user = db
    .prepare("SELECT id, locale FROM users WHERE email = ? AND email_verified_at IS NULL AND password_hash IS NOT NULL")
    .get(email) as { id: string; locale: "uz" | "ru" } | undefined;
  if (user) {
    const token = newToken();
    db.transaction(() => {
      db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'verify_email'").run(user.id);
      db.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at) VALUES (?,?,?,?)").run(sha256(token), user.id, "verify_email", now() + 24 * HOUR);
    })();
    await trySend(mailer, { to: email, ...mailTexts(user.locale, "verify", `${config.APP_ORIGIN}/#/verify?token=${token}`) });
  }
  return c.json(generic, 202);
});

authRoutes.post("/forgot", async (c) => {
  const { db, config, mailer, limiter, now } = c.get("deps");
  if (!limiter.take(`forgot-ip:${c.get("ip")}`, 10, HOUR)) return fail(c, 429, "too_many_requests");
  const body = emailOnly.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  const email = normEmail(body.data.email);
  const generic = { status: "check_email", message: t("check_email", c.get("locale")) };
  if (!limiter.take(`forgot-email:${email}`, 3, HOUR)) return c.json(generic, 202);

  const user = db.prepare("SELECT id, locale FROM users WHERE email = ? AND email_verified_at IS NOT NULL").get(email) as
    | { id: string; locale: "uz" | "ru" }
    | undefined;
  if (user) {
    const token = newToken();
    db.transaction(() => {
      db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'reset_password'").run(user.id);
      db.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at) VALUES (?,?,?,?)").run(sha256(token), user.id, "reset_password", now() + HOUR);
    })();
    audit(c, user.id, "forgot_requested");
    await trySend(mailer, { to: email, ...mailTexts(user.locale, "reset", `${config.APP_ORIGIN}/#/reset?token=${token}`) });
  }
  return c.json(generic, 202);
});

authRoutes.post("/reset", async (c) => {
  const { db, limiter, now } = c.get("deps");
  if (!limiter.take(`reset-ip:${c.get("ip")}`, 20, HOUR)) return fail(c, 429, "too_many_requests");
  const body = resetSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return fail(c, 400, "invalid_input");
  if (body.data.password.length < 10) return fail(c, 400, "weak_password");

  const t0 = now();
  const tokenHash = sha256(body.data.token);
  const row = db
    .prepare("SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > ?")
    .get(tokenHash, t0) as { user_id: string } | undefined;
  if (!row) return fail(c, 400, "invalid_token");

  const hash = await hashPassword(body.data.password);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.user_id);
    db.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?").run(t0, tokenHash);
    db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'reset_password' AND used_at IS NULL").run(row.user_id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id); // barcha qurilmalardan chiqarish
  })();
  audit(c, row.user_id, "password_reset");
  return c.json({ status: "reset" });
});
