import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import type { GoogleClient, GoogleProfile } from "../src/google.js";
import { HttpGoogleClient } from "../src/google.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";

const ORIGIN = "https://doda.tajriba24.uz";
const CONSENTS = { terms: true, personalData: true, crossBorder: true, voice: true };

let db: Db;
let app: ReturnType<typeof createApp>;
let profile: GoogleProfile;
let exchanged: Array<{ code: string; verifier: string }>;
let mailer: MemoryMailer;
let clock: number;

const fakeGoogle: GoogleClient = {
  authUrl: ({ state, challenge }) => `https://accounts.google.com/auth?state=${state}&c=${challenge}`,
  exchange: async (p) => {
    exchanged.push(p);
    if (p.code === "bad") throw new Error("boom");
    return profile;
  },
};

beforeEach(() => {
  db = openDb(":memory:");
  mailer = new MemoryMailer();
  exchanged = [];
  clock = 1_700_000_000_000;
  profile = { sub: "g-123", email: "Person@Gmail.com", emailVerified: true };
  app = createApp({
    config: loadConfig({ NODE_ENV: "test" }),
    db,
    mailer,
    now: () => clock,
    limiter: new RateLimiter(() => clock),
    google: fakeGoogle,
  });
});

async function start(body: object = { locale: "uz", consents: CONSENTS }) {
  const res = await app.request("/api/auth/google/start", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]!;
  const json = (await res.json()) as { url: string };
  const state = new URL(json.url).searchParams.get("state")!;
  return { res, cookie, state, json };
}

async function callback(state: string, cookie: string, code = "ok") {
  return app.request(`/api/auth/google/callback?code=${code}&state=${state}`, { headers: { cookie } });
}

const loc = (r: Response) => r.headers.get("location")!;

describe("Google bilan kirish", () => {
  it("sozlanmagan bo'lsa 404", async () => {
    const bare = createApp({ config: loadConfig({ NODE_ENV: "test" }), db, mailer });
    const res = await bare.request("/api/auth/google/start", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("yangi foydalanuvchi: rozilik bilan akkaunt yaratiladi va sessiya beriladi", async () => {
    const { cookie, state } = await start();
    const res = await callback(state, cookie);
    expect(res.status).toBe(302);
    expect(loc(res)).toBe(`${ORIGIN}/#/auth/done`);
    const u = db.prepare("SELECT email, google_sub, email_verified_at, password_hash FROM users").get() as Record<string, unknown>;
    expect(u.email).toBe("person@gmail.com");
    expect(u.google_sub).toBe("g-123");
    expect(u.email_verified_at).not.toBeNull();
    expect(u.password_hash).toBeNull();
    const consents = db.prepare("SELECT type, accepted FROM consents ORDER BY id").all();
    expect(consents).toEqual([
      { type: "terms", accepted: 1 },
      { type: "personal_data", accepted: 1 },
      { type: "cross_border", accepted: 1 },
      { type: "voice", accepted: 1 },
    ]);
    const sessionCookie = (res.headers.get("set-cookie") ?? "").split(",").find((c) => c.includes("doda_session="));
    expect(sessionCookie).toBeTruthy();
    const me = await app.request("/api/auth/me", { headers: { cookie: sessionCookie!.split(";")[0]!.trim() } });
    expect(me.status).toBe(200);
  });

  it("yangi foydalanuvchi roziliksiz: akkaunt yaratilmaydi", async () => {
    const { cookie, state } = await start({ locale: "uz" });
    const res = await callback(state, cookie);
    expect(loc(res)).toContain("code=consent_required");
    expect(db.prepare("SELECT COUNT(*) c FROM users").get()).toEqual({ c: 0 });
  });

  it("mavjud Google foydalanuvchi roziliksiz kira oladi", async () => {
    let s = await start();
    await callback(s.state, s.cookie);
    s = await start({ locale: "uz" });
    const res = await callback(s.state, s.cookie);
    expect(loc(res)).toBe(`${ORIGIN}/#/auth/done`);
    expect(db.prepare("SELECT COUNT(*) c FROM users").get()).toEqual({ c: 1 });
  });

  it("state cookie'ga mos kelmasa rad etiladi (CSRF)", async () => {
    const { state } = await start();
    const res = await callback(state, "doda_oauth=other");
    expect(loc(res)).toContain("code=state_invalid");
    expect(exchanged).toHaveLength(0);
  });

  it("state bir martalik", async () => {
    const { cookie, state } = await start();
    await callback(state, cookie);
    const again = await callback(state, cookie);
    expect(loc(again)).toContain("code=state_invalid");
  });

  it("state muddati tugagan bo'lsa rad etiladi", async () => {
    const { cookie, state } = await start();
    clock += 11 * 60 * 1000;
    expect(loc(await callback(state, cookie))).toContain("code=state_invalid");
  });

  it("Google xatosi: tushunarli yo'naltirish, akkaunt yaratilmaydi", async () => {
    const { cookie, state } = await start();
    const res = await callback(state, cookie, "bad");
    expect(loc(res)).toContain("code=google_failed");
    expect(db.prepare("SELECT COUNT(*) c FROM users").get()).toEqual({ c: 0 });
  });

  it("tasdiqlanmagan Google email rad etiladi", async () => {
    profile.emailVerified = false;
    const { cookie, state } = await start();
    expect(loc(await callback(state, cookie))).toContain("code=email_unverified");
  });

  it("PKCE: verifier tokenga yuboriladi, challenge URL'da", async () => {
    const { cookie, state, json } = await start();
    await callback(state, cookie);
    expect(exchanged[0]!.verifier.length).toBeGreaterThan(20);
    expect(json.url).toContain("c=");
  });

  it("tasdiqlangan parolli akkaunt Google'ga bog'lanadi, parol saqlanadi", async () => {
    db.prepare("INSERT INTO users (id, email, password_hash, email_verified_at, locale, created_at) VALUES ('u1','person@gmail.com','scrypt$x',1,'uz',1)").run();
    const { cookie, state } = await start({ locale: "uz" });
    await callback(state, cookie);
    const u = db.prepare("SELECT google_sub, password_hash FROM users WHERE id='u1'").get() as Record<string, unknown>;
    expect(u.google_sub).toBe("g-123");
    expect(u.password_hash).toBe("scrypt$x");
  });

  it("tasdiqlanmagan parolli akkaunt: parol bekor qilinadi (oldindan egallash hujumi)", async () => {
    db.prepare("INSERT INTO users (id, email, password_hash, locale, created_at) VALUES ('u2','person@gmail.com','scrypt$attacker','uz',1)").run();
    db.prepare("INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES ('h','u2',1,9999999999999)").run();
    const { cookie, state } = await start({ locale: "uz" });
    await callback(state, cookie);
    const u = db.prepare("SELECT google_sub, password_hash, email_verified_at FROM users WHERE id='u2'").get() as Record<string, unknown>;
    expect(u.google_sub).toBe("g-123");
    expect(u.password_hash).toBeNull();
    expect(u.email_verified_at).not.toBeNull();
    expect(db.prepare("SELECT COUNT(*) c FROM sessions WHERE id_hash='h'").get()).toEqual({ c: 0 });
  });
});

describe("HttpGoogleClient", () => {
  it("auth URL to'g'ri parametrlar bilan quriladi", () => {
    const g = new HttpGoogleClient("cid", "sec", "https://api.example/cb");
    const u = new URL(g.authUrl({ state: "S", challenge: "C" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("redirect_uri")).toBe("https://api.example/cb");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")).toBe("openid email");
    expect(u.toString()).not.toContain("sec");
  });

  it("kodni almashtirib profil oladi", async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: string) => {
      calls.push(url);
      if (url.includes("oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "AT" }));
      return new Response(JSON.stringify({ sub: "s1", email: "a@b.co", email_verified: true }));
    }) as unknown as typeof fetch;
    const g = new HttpGoogleClient("cid", "sec", "https://api.example/cb", fetchFn);
    expect(await g.exchange({ code: "c", verifier: "v" })).toEqual({ sub: "s1", email: "a@b.co", emailVerified: true });
    expect(calls).toHaveLength(2);
  });
});
