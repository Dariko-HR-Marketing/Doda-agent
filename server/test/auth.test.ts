import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";

const ORIGIN = "https://doda.tajriba24.uz";
const GOOD = {
  email: "Test@Example.com",
  password: "correct-horse-battery",
  locale: "uz",
  consents: { terms: true, personalData: true, crossBorder: true, voice: false },
};

let db: Db;
let mailer: MemoryMailer;
let app: ReturnType<typeof createApp>;
let clock: number;

function setup(env: Record<string, string> = {}) {
  db = openDb(":memory:");
  mailer = new MemoryMailer();
  clock = 1_700_000_000_000;
  app = createApp({
    config: loadConfig({ NODE_ENV: "test", ...env }),
    db,
    mailer,
    now: () => clock,
    limiter: new RateLimiter(() => clock),
  });
}

function post(path: string, body: unknown, headers: Record<string, string> = {}, method = "POST") {
  return app.request(path, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function tokenFromMail(): string {
  const m = mailer.outbox.at(-1)!.text.match(/token=([\w-]+)/);
  return m![1]!;
}

function cookieOf(res: Response): string {
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}

async function registerAndVerify(body = GOOD): Promise<void> {
  expect((await post("/api/auth/register", body)).status).toBe(202);
  const res = await post("/api/auth/verify-email", { token: tokenFromMail() });
  expect(res.status).toBe(200);
}

async function login(): Promise<Response> {
  return post("/api/auth/login", { email: "test@example.com", password: GOOD.password });
}

beforeEach(() => setup());

describe("health va xavfsizlik sarlavhalari", () => {
  it("health ishlaydi va xavfsizlik sarlavhalari bor", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("begona Origin rad etiladi", async () => {
    const res = await post("/api/auth/login", {}, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("JSON bo'lmagan o'zgartiruvchi so'rov rad etiladi", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "text/plain", origin: ORIGIN },
      body: "email=a",
    });
    expect(res.status).toBe(400);
  });
});

describe("ro'yxatdan o'tish", () => {
  it("rozilik bo'lmasa rad etadi", async () => {
    const res = await post("/api/auth/register", { ...GOOD, consents: { ...GOOD.consents, crossBorder: false } });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("consent_required");
    expect(db.prepare("SELECT COUNT(*) c FROM users").get()).toEqual({ c: 0 });
  });

  it("kuchsiz parolni rad etadi (ruscha xabar bilan)", async () => {
    const res = await post("/api/auth/register", { ...GOOD, password: "short" }, { "accept-language": "ru" });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error.code).toBe("weak_password");
    expect(j.error.message).toContain("10");
  });

  it("muvaffaqiyatli: parol xeshlanadi, rozilik jurnali yoziladi, tasdiq xati ketadi", async () => {
    const res = await post("/api/auth/register", GOOD);
    expect(res.status).toBe(202);
    const u = db.prepare("SELECT email, password_hash FROM users").get() as { email: string; password_hash: string };
    expect(u.email).toBe("test@example.com");
    expect(u.password_hash.startsWith("scrypt$")).toBe(true);
    expect(u.password_hash).not.toContain(GOOD.password);
    const rows = db.prepare("SELECT type, accepted, version FROM consents ORDER BY id").all();
    expect(rows).toEqual([
      { type: "terms", accepted: 1, version: "2026-11-draft" },
      { type: "personal_data", accepted: 1, version: "2026-11-draft" },
      { type: "cross_border", accepted: 1, version: "2026-11-draft" },
      { type: "voice", accepted: 0, version: "2026-11-draft" },
    ]);
    expect(mailer.outbox).toHaveLength(1);
  });

  it("mavjud email oshkor qilinmaydi: javob bir xil", async () => {
    await post("/api/auth/register", GOOD);
    const second = await post("/api/auth/register", GOOD);
    expect(second.status).toBe(202);
    expect((await second.json()).status).toBe("check_email");
    expect(db.prepare("SELECT COUNT(*) c FROM users").get()).toEqual({ c: 1 });
    expect(mailer.outbox).toHaveLength(2);
  });

  it("ro'yxatdan o'tish chastotasi cheklanadi", async () => {
    for (let i = 0; i < 10; i++) {
      await post("/api/auth/register", { ...GOOD, email: `u${i}@example.com` });
    }
    const res = await post("/api/auth/register", { ...GOOD, email: "x@example.com" });
    expect(res.status).toBe(429);
  });
});

describe("pochta tasdiqlash va kirish", () => {
  it("tasdiqlanmaguncha kirib bo'lmaydi", async () => {
    await post("/api/auth/register", GOOD);
    const res = await login();
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("email_not_verified");
  });

  it("tasdiqlash tokeni bir marta ishlaydi", async () => {
    await post("/api/auth/register", GOOD);
    const token = tokenFromMail();
    expect((await post("/api/auth/verify-email", { token })).status).toBe(200);
    expect((await post("/api/auth/verify-email", { token })).status).toBe(400);
  });

  it("tasdiqlash tokeni 24 soatdan keyin yaroqsiz", async () => {
    await post("/api/auth/register", GOOD);
    const token = tokenFromMail();
    clock += 25 * 60 * 60 * 1000;
    expect((await post("/api/auth/verify-email", { token })).status).toBe(400);
  });

  it("to'liq oqim: kirish, me, chiqish", async () => {
    await registerAndVerify();
    const res = await login();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const cookie = cookieOf(res);

    const me = await app.request("/api/auth/me", { headers: { cookie } });
    expect(me.status).toBe(200);
    const j = await me.json();
    expect(j.user.email).toBe("test@example.com");
    expect(j.consents.terms.accepted).toBe(true);
    expect(j.consents.voice.accepted).toBe(false);

    const out = await post("/api/auth/logout", {}, { cookie });
    expect(out.status).toBe(200);
    expect((await app.request("/api/auth/me", { headers: { cookie } })).status).toBe(401);
  });

  it("noto'g'ri parol va noma'lum email bir xil xato beradi", async () => {
    await registerAndVerify();
    const wrong = await post("/api/auth/login", { email: "test@example.com", password: "wrong-password-1" });
    const unknown = await post("/api/auth/login", { email: "nobody@example.com", password: "wrong-password-1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).error.code).toBe((await unknown.json()).error.code);
  });

  it("bir email'ga ketma-ket urinishlar cheklanadi", async () => {
    await registerAndVerify();
    for (let i = 0; i < 8; i++) {
      await post("/api/auth/login", { email: "test@example.com", password: "wrong-password-1" });
    }
    const res = await login();
    expect(res.status).toBe(429);
  });

  it("sessiya muddati tugagach rad etiladi", async () => {
    await registerAndVerify();
    const cookie = cookieOf(await login());
    clock += 31 * 24 * 60 * 60 * 1000;
    expect((await app.request("/api/auth/me", { headers: { cookie } })).status).toBe(401);
  });

  it("cookie'siz /me 401 beradi", async () => {
    expect((await app.request("/api/auth/me")).status).toBe(401);
  });
});

describe("akkaunt", () => {
  it("ovoz roziligini o'zgartirish jurnalga yangi yozuv qo'shadi", async () => {
    await registerAndVerify();
    const cookie = cookieOf(await login());
    const res = await post("/api/account/consents", { type: "voice", accepted: true }, { cookie });
    expect(res.status).toBe(200);
    expect((await res.json()).consents.voice.accepted).toBe(true);
    expect(db.prepare("SELECT COUNT(*) c FROM consents WHERE type='voice'").get()).toEqual({ c: 2 });
  });

  it("majburiy rozilikni shu yo'l bilan qaytarib bo'lmaydi", async () => {
    await registerAndVerify();
    const cookie = cookieOf(await login());
    const res = await post("/api/account/consents", { type: "terms", accepted: false }, { cookie });
    expect(res.status).toBe(400);
  });

  it("akkaunt o'chirilganda barcha bog'liq ma'lumot o'chadi, audit shaxsiy ma'lumotsiz qoladi", async () => {
    await registerAndVerify();
    const cookie = cookieOf(await login());
    const res = await post("/api/account", undefined, { cookie }, "DELETE");
    expect(res.status).toBe(200);
    for (const table of ["users", "sessions", "consents", "email_tokens"]) {
      expect(db.prepare(`SELECT COUNT(*) c FROM ${table}`).get()).toEqual({ c: 0 });
    }
    const audits = db.prepare("SELECT action, user_ref FROM audit_log").all() as Array<{ action: string; user_ref: string | null }>;
    expect(audits.some((a) => a.action === "account_deleted")).toBe(true);
    expect(JSON.stringify(audits)).not.toContain("example.com");
  });
});

describe("pochta xizmati ishlamasa", () => {
  it("ro'yxatdan o'tish 500 bermaydi, foydalanuvchi qayta yuborish orqali tasdiqlay oladi", async () => {
    const failing = { send: async () => { throw new Error("smtp down"); } };
    app = createApp({ config: loadConfig({ NODE_ENV: "test" }), db, mailer: failing, now: () => clock, limiter: new RateLimiter(() => clock) });
    const res = await post("/api/auth/register", GOOD);
    expect(res.status).toBe(202);
    expect(db.prepare("SELECT COUNT(*) c FROM users").get()).toEqual({ c: 1 });
  });
});

describe("tasdiqlash xatini qayta yuborish", () => {
  it("yangi token yuboriladi, eskisi yaroqsiz bo'ladi", async () => {
    await post("/api/auth/register", GOOD);
    const oldToken = tokenFromMail();
    const res = await post("/api/auth/resend-verification", { email: GOOD.email });
    expect(res.status).toBe(202);
    expect(mailer.outbox).toHaveLength(2);
    const fresh = tokenFromMail();
    expect(fresh).not.toBe(oldToken);
    expect((await post("/api/auth/verify-email", { token: oldToken })).status).toBe(400);
    expect((await post("/api/auth/verify-email", { token: fresh })).status).toBe(200);
  });

  it("tasdiqlangan yoki noma'lum email uchun xat ketmaydi, javob bir xil", async () => {
    await registerAndVerify();
    const before = mailer.outbox.length;
    const a = await post("/api/auth/resend-verification", { email: GOOD.email });
    const b = await post("/api/auth/resend-verification", { email: "nobody@example.com" });
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(await a.json()).toEqual(await b.json());
    expect(mailer.outbox.length).toBe(before);
  });

  it("bir email'ga soatiga 3 ta xat", async () => {
    await post("/api/auth/register", GOOD);
    for (let i = 0; i < 5; i++) await post("/api/auth/resend-verification", { email: GOOD.email });
    expect(mailer.outbox).toHaveLength(1 + 3);
  });
});

describe("parolni tiklash", () => {
  it("to'liq oqim: so'rov, yangi parol, eski parol ishlamaydi, sessiyalar bekor qilinadi", async () => {
    await registerAndVerify();
    const cookie = cookieOf(await login());
    expect((await app.request("/api/auth/me", { headers: { cookie } })).status).toBe(200);

    expect((await post("/api/auth/forgot", { email: GOOD.email })).status).toBe(202);
    const token = tokenFromMail();
    expect(mailer.outbox.at(-1)!.text).toContain("#/reset?token=");

    const res = await post("/api/auth/reset", { token, password: "brand-new-password-1" });
    expect(res.status).toBe(200);
    expect((await app.request("/api/auth/me", { headers: { cookie } })).status).toBe(401);
    expect((await login()).status).toBe(401);
    const ok = await post("/api/auth/login", { email: "test@example.com", password: "brand-new-password-1" });
    expect(ok.status).toBe(200);
  });

  it("token bir martalik, kuchsiz parol rad etiladi, muddati 1 soat", async () => {
    await registerAndVerify();
    await post("/api/auth/forgot", { email: GOOD.email });
    const token = tokenFromMail();
    expect((await post("/api/auth/reset", { token, password: "short" })).status).toBe(400);
    expect((await post("/api/auth/reset", { token, password: "brand-new-password-1" })).status).toBe(200);
    expect((await post("/api/auth/reset", { token, password: "another-password-22" })).status).toBe(400);

    await post("/api/auth/forgot", { email: GOOD.email });
    const t2 = tokenFromMail();
    clock += 61 * 60 * 1000;
    expect((await post("/api/auth/reset", { token: t2, password: "another-password-22" })).status).toBe(400);
  });

  it("tasdiqlanmagan yoki noma'lum email uchun xat ketmaydi", async () => {
    await post("/api/auth/register", GOOD);
    const before = mailer.outbox.length;
    const a = await post("/api/auth/forgot", { email: GOOD.email });
    const b = await post("/api/auth/forgot", { email: "nobody@example.com" });
    expect(await a.json()).toEqual(await b.json());
    expect(mailer.outbox.length).toBe(before);
  });
});

describe("himoya", () => {
  it("katta so'rov tanasi rad etiladi", async () => {
    const res = await post("/api/auth/login", { email: "a@b.co", password: "x".repeat(20_000) });
    expect(res.status).toBe(400);
  });

  it("birovning emailiga urinishlar boshqa IP'dan kirishni bloklamaydi", async () => {
    setup({ TRUST_PROXY: "true" });
    await registerAndVerify();
    const attacker = { "x-forwarded-for": "6.6.6.6" };
    for (let i = 0; i < 8; i++) await post("/api/auth/login", { email: "test@example.com", password: "wrong-password-1" }, attacker);
    expect((await post("/api/auth/login", { email: "test@example.com", password: "wrong-password-1" }, attacker)).status).toBe(429);
    const owner = await post("/api/auth/login", { email: "test@example.com", password: GOOD.password }, { "x-forwarded-for": "7.7.7.7" });
    expect(owner.status).toBe(200);
  });
});
