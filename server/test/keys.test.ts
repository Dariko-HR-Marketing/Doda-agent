import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";
import { LlmHttpError, type LlmEvent, type LlmProvider } from "../src/llm/types.js";
import { cleanKey, decryptKey, encryptKey } from "../src/userkeys.js";

const ORIGIN = "https://doda.tajriba24.uz";
const PASS = "correct-horse-battery";
const SECRET = "test-secret-".padEnd(40, "x");
const K = {
  anthropic: "sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1111",
  openai: "sk-proj-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2222",
  gemini: "AIzaCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC3333",
};

let db: Db;
let mailer: MemoryMailer;
let app: ReturnType<typeof createApp>;
let clock: number;
/** Fabrika chaqiruvlari: qaysi provayder qaysi kalit bilan nima so'radi */
let calls: Array<{ provider: string; key: string; op: string; model: string }>;
/** kalit -> status (xato simulyatsiyasi) */
let failing: Record<string, number>;

function fakeFor(provider: string, key: string): LlmProvider {
  const guard = (op: string, model: string) => {
    calls.push({ provider, key, op, model });
    if (failing[key]) throw new LlmHttpError(failing[key]!);
  };
  return {
    async complete(p) { guard("complete", p.model); return { text: p.json ? '{"facts": []}' : "ok", tokensIn: 100, tokensOut: 50 }; },
    async transcribe(p) { guard("stt", p.model); return { text: "ovoz matni", tokensIn: 100, tokensOut: 10 }; },
    stream(p) {
      return (async function* (): AsyncIterable<LlmEvent> {
        guard("stream", p.model);
        yield { type: "delta", text: `[${provider}] javob` };
        yield { type: "usage", tokensIn: 1000, tokensOut: 500 };
      })();
    },
  };
}

function build(env: Record<string, string> = {}, shared: LlmProvider | null = null) {
  db = openDb(":memory:");
  mailer = new MemoryMailer();
  calls = [];
  failing = {};
  clock = Date.UTC(2026, 10, 21, 12, 0, 0);
  app = createApp({
    config: loadConfig({ NODE_ENV: "test", KEYS_SECRET: SECRET, ...env }),
    db, mailer, llm: shared, now: () => clock, limiter: new RateLimiter(() => clock),
    providerFactory: (provider, key) => fakeFor(provider, key),
  });
}
beforeEach(() => build());

const req = (path: string, method = "GET", body?: unknown, cookie = "") =>
  app.request(path, { method, headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

async function signup(email: string): Promise<string> {
  await req("/api/auth/register", "POST", { email, password: PASS, locale: "uz", consents: { terms: true, personalData: true, crossBorder: true, voice: true } });
  const mail = [...mailer.outbox].reverse().find((m) => m.to === email)!;
  await req("/api/auth/verify-email", "POST", { token: mail.text.match(/token=([\w-]+)/)![1] });
  const res = await req("/api/auth/login", "POST", { email, password: PASS });
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}
const putKey = (c: string, p: string, key: string, extra: object = {}) => req(`/api/keys/${p}`, "PUT", { key, ...extra }, c);
async function chat(c: string, message = "salom") {
  const res = await req("/api/chat", "POST", { message }, c);
  const txt = await res.text();
  return { res, txt };
}

describe("shifrlash", () => {
  it("AES-256-GCM: ochiladi, ochiq matn yo'q, boshqa foydalanuvchi/provayder/sir bilan ochilmaydi", () => {
    const enc = encryptKey(SECRET, "u1", "anthropic", K.anthropic);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain(K.anthropic);
    expect(decryptKey(SECRET, "u1", "anthropic", enc)).toBe(K.anthropic);
    expect(decryptKey(SECRET, "u2", "anthropic", enc)).toBeNull(); // boshqa foydalanuvchi
    expect(decryptKey(SECRET, "u1", "openai", enc)).toBeNull(); // boshqa provayder
    expect(decryptKey("boshqa-sir".padEnd(40, "y"), "u1", "anthropic", enc)).toBeNull();
    expect(decryptKey(SECRET, "u1", "anthropic", enc.slice(0, -3) + "AAA")).toBeNull(); // buzilgan
    expect(encryptKey(SECRET, "u1", "anthropic", K.anthropic)).not.toBe(enc); // har safar yangi IV
  });

  it("cleanKey bo'shliq va qo'shtirnoqlarni olib tashlaydi", () => {
    expect(cleanKey('  "sk-ant-abc"\n')).toBe("sk-ant-abc");
  });
});

describe("kalitlar API", () => {
  it("kirishsiz rad etiladi; boshida hech narsa ulanmagan", async () => {
    expect((await req("/api/keys")).status).toBe(401);
    const c = await signup("a@example.com");
    const r = await (await req("/api/keys", "GET", undefined, c)).json();
    expect(r.storageReady).toBe(true);
    expect(r.providers.map((p: any) => [p.id, p.connected])).toEqual([["anthropic", false], ["gemini", false], ["openai", false]]);
  });

  it("saqlash: tekshiriladi, shifrlanadi, javobda faqat oxirgi 4 belgi", async () => {
    const c = await signup("a@example.com");
    const res = await putKey(c, "anthropic", K.anthropic);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ connected: true, last4: "1111", warning: null });
    expect(JSON.stringify(j)).not.toContain(K.anthropic);
    expect(calls[0]).toMatchObject({ provider: "anthropic", key: K.anthropic, op: "complete" });
    const list = await (await req("/api/keys", "GET", undefined, c)).json();
    expect(JSON.stringify(list)).not.toContain("sk-ant");
    expect(list.providers[0]).toMatchObject({ id: "anthropic", connected: true, last4: "1111", status: "active" });
    // bazada ochiq matn yo'q, audit jurnalida ham
    const raw = JSON.stringify(db.prepare("SELECT * FROM user_api_keys").all()) + JSON.stringify(db.prepare("SELECT * FROM audit_log").all());
    expect(raw).not.toContain(K.anthropic);
    expect(raw).not.toContain("AAAAAAAAAAAA");
    expect((db.prepare("SELECT action FROM audit_log WHERE action LIKE 'key_%'").all() as any[]).map((x) => x.action)).toEqual(["key_set:anthropic"]);
  });

  it("format va provayder tekshiruvi", async () => {
    const c = await signup("a@example.com");
    expect((await putKey(c, "anthropic", "sk-ant-qisqa")).status).toBe(400);
    expect((await putKey(c, "openai", K.gemini)).status).toBe(400); // boshqa provayder kaliti
    expect((await putKey(c, "gemini", "AIza<script>alert(1)</script>xxxxxxxxxxxxxxxxxxxxxxxx")).status).toBe(400);
    expect((await putKey(c, "azure", K.openai)).status).toBe(404);
    expect((await req("/api/keys/openai", "PUT", { nokey: 1 }, c)).status).toBe(400);
    expect(calls).toHaveLength(0); // noto'g'ri kalit provayderga yuborilmaydi
  });

  it("provayder xatolari: 401/403 rad, 400 tekshiruv xatosi, 429 saqlanadi, tarmoq 503, verify:false", async () => {
    const c = await signup("a@example.com");
    failing[K.openai] = 401;
    const r1 = await putKey(c, "openai", K.openai);
    expect(r1.status).toBe(400);
    expect((await r1.json()).error.code).toBe("key_rejected");
    failing[K.openai] = 400;
    expect((await (await putKey(c, "openai", K.openai)).json()).error.code).toBe("key_check_failed");
    failing[K.openai] = 500;
    const r3 = await putKey(c, "openai", K.openai);
    expect(r3.status).toBe(503);
    expect((await r3.json()).error.code).toBe("key_check_unreachable");
    expect((await (await req("/api/keys", "GET", undefined, c)).json()).providers.find((p: any) => p.id === "openai").connected).toBe(false);
    failing[K.openai] = 429;
    expect((await (await putKey(c, "openai", K.openai)).json()).warning).toBe("quota");
    await req("/api/keys/openai", "DELETE", undefined, c);
    failing[K.gemini] = 403;
    const r5 = await putKey(c, "gemini", K.gemini, { verify: false });
    expect((await r5.json()).warning).toBe("unverified");
  });

  it("o'chirish; boshqa foydalanuvchi kalitiga tegolmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    await putKey(a, "anthropic", K.anthropic);
    await req("/api/keys/anthropic", "DELETE", undefined, b); // B o'zinikini o'chiradi (yo'q), A niki saqlanadi
    expect((await (await req("/api/keys", "GET", undefined, a)).json()).providers[0].connected).toBe(true);
    expect((await (await req("/api/keys", "GET", undefined, b)).json()).providers[0].connected).toBe(false);
    await req("/api/keys/anthropic", "DELETE", undefined, a);
    expect(db.prepare("SELECT COUNT(*) c FROM user_api_keys").get()).toEqual({ c: 0 });
  });

  it("KEYS_SECRET yo'q bo'lsa saqlash 503", async () => {
    db = openDb(":memory:");
    const cfg = loadConfig({ NODE_ENV: "test" });
    mailer = new MemoryMailer();
    app = createApp({ config: cfg, db, mailer, now: () => clock, limiter: new RateLimiter(() => clock) });
    const c = await signup("a@example.com");
    expect((await putKey(c, "anthropic", K.anthropic)).status).toBe(503);
    expect((await (await req("/api/keys", "GET", undefined, c)).json()).storageReady).toBe(false);
  });
});

describe("har kim o'z kaliti bilan, xarajat o'z akkauntiga", () => {
  it("kalitsiz foydalanuvchi: 403 api_key_required, hech qaysi provayder chaqirilmaydi", async () => {
    const c = await signup("a@example.com");
    const { res, txt } = await chat(c);
    expect(res.status).toBe(403);
    expect(JSON.parse(txt).error.code).toBe("api_key_required");
    expect(calls).toHaveLength(0);
    expect((await req("/api/tasks/plan", "POST", { goal: "Katta maqsad yozdim" }, c)).status).toBe(403);
    expect((await req("/api/voice/transcribe", "POST", { mime: "audio/webm", data: Buffer.alloc(900, 1).toString("base64") }, c)).status).toBe(403);
  });

  it("A ning so'rovi faqat A ning kaliti bilan, B niki B ning kaliti bilan ketadi; sarf har birining hisobida (own=1)", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    await putKey(a, "anthropic", K.anthropic);
    await putKey(b, "openai", K.openai);
    calls.length = 0;
    const ra = await chat(a);
    const rb = await chat(b);
    expect(ra.txt).toContain("[anthropic]");
    expect(rb.txt).toContain("[openai]");
    expect(calls.filter((x) => x.op === "stream").map((x) => [x.provider, x.key])).toEqual([["anthropic", K.anthropic], ["openai", K.openai]]);
    const rows = db.prepare("SELECT u.email, g.model, g.own, g.cost_usd FROM usage g JOIN users u ON u.id = g.user_id ORDER BY g.id").all() as any[];
    expect(rows.map((r) => [r.email, r.model, r.own])).toEqual([["a@example.com", "claude-haiku-5-5", 1], ["b@example.com", "gpt-6-luna", 1]]);
    // hisobot: har kimga o'zi, provayderlar bo'yicha
    const ua = await (await req("/api/usage", "GET", undefined, a)).json();
    expect(ua.ownUsd).toBeGreaterThan(0);
    expect(ua.sharedUsd).toBe(0);
    expect(ua.byProvider.anthropic.usd).toBeGreaterThan(0);
    expect(ua.byProvider.openai.usd).toBe(0);
    const ub = await (await req("/api/usage", "GET", undefined, b)).json();
    expect(ub.byProvider.openai.usd).toBeGreaterThan(0);
    expect(ub.byProvider.anthropic.usd).toBe(0);
  });

  it("agent, vazifa rejasi va ovoz ham foydalanuvchining o'z kaliti bilan va o'z hisobiga", async () => {
    const a = await signup("a@example.com");
    await putKey(a, "gemini", K.gemini);
    calls.length = 0;
    const ag = (await (await req("/api/agents", "POST", { template: "hr" }, a)).json()).agent;
    expect((await req(`/api/agents/${ag.id}/run`, "POST", { request: "Vakansiya yoz" }, a)).status).toBe(201);
    expect((await req("/api/voice/transcribe", "POST", { mime: "audio/webm", data: Buffer.alloc(900, 1).toString("base64"), lang: "uz" }, a)).status).toBe(200);
    expect(new Set(calls.map((x) => x.key))).toEqual(new Set([K.gemini]));
    const own = db.prepare("SELECT COUNT(*) c FROM usage WHERE own = 1").get() as { c: number };
    const shared = db.prepare("SELECT COUNT(*) c FROM usage WHERE own = 0").get() as { c: number };
    expect(own.c).toBeGreaterThanOrEqual(3);
    expect(shared.c).toBe(0);
  });

  it("o'z kalitiga server byudjeti qo'llanmaydi (xarajat foydalanuvchining o'zida)", async () => {
    build({ MONTHLY_BUDGET_USD: "0.0001" });
    const a = await signup("a@example.com");
    await putKey(a, "anthropic", K.anthropic);
    await chat(a);
    const second = await chat(a, "yana bir savol");
    expect(second.res.status).toBe(200);
    expect(second.txt).toContain("[anthropic]");
    expect(JSON.parse(/event: done\ndata: (.+)/.exec(second.txt)![1]!)).toMatchObject({ own: true, budgetUsd: null });
  });

  it("provayder kalitni rad etsa (401): kalit 'yaroqsiz' deb belgilanadi va keyingi provayderga o'tiladi", async () => {
    const a = await signup("a@example.com");
    await putKey(a, "anthropic", K.anthropic);
    await putKey(a, "openai", K.openai);
    failing[K.anthropic] = 401;
    const { txt } = await chat(a);
    expect(txt).toContain("[openai]");
    const list = await (await req("/api/keys", "GET", undefined, a)).json();
    expect(list.providers.find((p: any) => p.id === "anthropic").status).toBe("invalid");
    // kalit almashtirilsa, qayta faol bo'ladi
    failing = {};
    await putKey(a, "anthropic", K.anthropic);
    expect((await (await req("/api/keys", "GET", undefined, a)).json()).providers.find((p: any) => p.id === "anthropic").status).toBe("active");
  });

  it("kalit o'chirilsa, keyingi so'rov darrov rad etiladi (kesh tozalanadi)", async () => {
    const a = await signup("a@example.com");
    await putKey(a, "anthropic", K.anthropic);
    expect((await chat(a)).res.status).toBe(200);
    await req("/api/keys/anthropic", "DELETE", undefined, a);
    expect((await chat(a)).res.status).toBe(403);
  });

  it("server kaliti faqat ruxsat berilganda (umumiy provayder) va o'z kaliti ustun", async () => {
    const shared = fakeFor("shared", "SERVERKEY");
    build({}, shared);
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    await putKey(a, "anthropic", K.anthropic);
    expect((await chat(a)).txt).toContain("[anthropic]");
    expect((await chat(b)).txt).toContain("[shared]");
    const rows = db.prepare("SELECT own FROM usage ORDER BY id").all() as any[];
    expect(rows.map((r) => r.own)).toEqual([1, 0]);
  });
});
