import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { LlmHttpError, type LlmEvent, type LlmMessage, type LlmProvider } from "../src/llm/types.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";
import { buildBrief, parseReview } from "../src/agents.js";

const ORIGIN = "https://doda.tajriba24.uz";
const PASS = "correct-horse-battery";

interface StreamCall { model: string; system: string; messages: LlmMessage[] }
let streamCalls: StreamCall[];
let completeCalls: Array<{ model: string; system: string; messages: LlmMessage[]; json?: boolean }>;
let completeText: string | (() => never);
let db: Db;
let mailer: MemoryMailer;
let app: ReturnType<typeof createApp>;
let clock: number;

const fake: LlmProvider = {
  transcribe: async () => ({ text: "", tokensIn: 0, tokensOut: 0 }),
  async complete(p) {
    completeCalls.push({ model: p.model, system: p.system, messages: p.messages, json: p.json });
    if (typeof completeText === "function") completeText();
    return { text: completeText as string, tokensIn: 50, tokensOut: 20 };
  },
  stream(p) {
    streamCalls.push({ model: p.model, system: p.system, messages: p.messages.map((m) => ({ ...m })) });
    return (async function* (): AsyncIterable<LlmEvent> {
      yield { type: "delta", text: "Yaxshi." };
      yield { type: "usage", tokensIn: 100, tokensOut: 10 };
    })();
  },
};

beforeEach(() => {
  db = openDb(":memory:");
  mailer = new MemoryMailer();
  streamCalls = [];
  completeCalls = [];
  completeText = '{"facts": []}';
  clock = Date.UTC(2026, 10, 21, 12, 0, 0);
  app = createApp({ config: loadConfig({ NODE_ENV: "test" }), db, mailer, llm: fake, now: () => clock, limiter: new RateLimiter(() => clock) });
});

const req = (path: string, method = "GET", body?: unknown, cookie = "") =>
  app.request(path, { method, headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

async function signup(email: string): Promise<string> {
  await req("/api/auth/register", "POST", { email, password: PASS, locale: "uz", consents: { terms: true, personalData: true, crossBorder: true, voice: false } });
  const mail = [...mailer.outbox].reverse().find((m) => m.to === email)!;
  await req("/api/auth/verify-email", "POST", { token: mail.text.match(/token=([\w-]+)/)![1] });
  const res = await req("/api/auth/login", "POST", { email, password: PASS });
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}


async function sse2(cookie: string, message: string) {
  const res = await req("/api/chat", "POST", { message }, cookie);
  await res.text();
  await new Promise((r) => setTimeout(r, 30));
}
let queue: Array<string | Error>;
const wfake: LlmProvider = {
  transcribe: async () => ({ text: "", tokensIn: 0, tokensOut: 0 }),
  async complete(p) {
    completeCalls.push({ model: p.model, system: p.system, messages: p.messages, json: p.json });
    const n = queue.shift();
    if (n instanceof Error) throw n;
    return { text: n ?? "", tokensIn: 100, tokensOut: 50 };
  },
  stream: fake.stream,
};
const OK = JSON.stringify({ verdict: "ok", notes: "Yaxshi." });

beforeEach(() => {
  queue = [];
  app = createApp({ config: loadConfig({ NODE_ENV: "test" }), db, mailer, llm: wfake, now: () => clock, limiter: new RateLimiter(() => clock) });
});

const mk = async (c: string, template = "hr") => (await (await req("/api/agents", "POST", { template }, c)).json()).agent;

describe("agentlar", () => {
  it("kirishsiz rad etiladi, shablonlar ro'yxati bor", async () => {
    expect((await req("/api/agents")).status).toBe(401);
    const c = await signup("a@example.com");
    const r = await (await req("/api/agents", "GET", undefined, c)).json();
    expect(r.agents).toEqual([]);
    expect(r.templates.map((t: any) => t.id)).toEqual(["hr", "marketing", "it", "sales", "analyst"]);
  });

  it("shablondan va qo'lda agent yaratish, tahrirlash, o'chirish", async () => {
    const c = await signup("a@example.com");
    const a = await mk(c, "marketing");
    expect(a).toMatchObject({ template: "marketing", name: "Marketing agent" });
    const b = (await (await req("/api/agents", "POST", { name: "Yurist", role: "Shartnomalar", instructions: "Sen yuristsan." }, c)).json()).agent;
    expect(b.template).toBeNull();
    const p = await (await req(`/api/agents/${b.id}`, "PATCH", { name: "Yurist 2" }, c)).json();
    expect(p.agent.name).toBe("Yurist 2");
    expect((await req("/api/agents", "POST", { template: "yo'q" }, c)).status).toBe(400);
    expect((await req(`/api/agents/${a.id}`, "DELETE", undefined, c)).status).toBe(200);
    expect((await (await req("/api/agents", "GET", undefined, c)).json()).agents).toHaveLength(1);
  });

  it("limit: 20 ta agent", async () => {
    const c = await signup("a@example.com");
    for (let i = 0; i < 20; i++) await mk(c);
    expect((await req("/api/agents", "POST", { template: "hr" }, c)).status).toBe(400);
  });

  it("topshiriq: agent bajaradi, DODA tekshiradi, sarf va tarix yoziladi", async () => {
    const c = await signup("a@example.com");
    const a = await mk(c, "hr");
    queue = ["Vakansiya matni: ...", OK];
    const res = await req(`/api/agents/${a.id}/run`, "POST", { request: "Menejer uchun vakansiya yoz", tier: "main" }, c);
    expect(res.status).toBe(201);
    const run = (await res.json()).run;
    expect(run).toMatchObject({ result: "Vakansiya matni: ...", verdict: "ok", review: "Yaxshi." });
    expect(completeCalls).toHaveLength(2);
    expect(completeCalls[0]!.model).toBe("gemini-3.8-flash");
    expect(completeCalls[1]!.model).toBe("gemini-3.5-flash-lite");
    expect(completeCalls[1]!.json).toBe(true);
    const hist = (await (await req(`/api/agents/${a.id}/runs`, "GET", undefined, c)).json()).runs;
    expect(hist).toHaveLength(1);
    expect((await (await req("/api/usage", "GET", undefined, c)).json()).tokensIn).toBe(200);
    // agent kartasida shu oy ishlari soni va sarfi
    const card = (await (await req("/api/agents", "GET", undefined, c)).json()).agents.find((x: any) => x.id === a.id);
    expect(card.runsMonth).toBe(1);
    expect(card.costMonthUsd).toBeGreaterThan(0);
    expect(card.costMonthUsd).toBeCloseTo(run.costUsd, 8);
  });

  it("izolyatsiya: agent suhbat tarixi va xotirani ko'rmaydi; faqat brief", async () => {
    const c = await signup("a@example.com");
    await sse2(c, "Mening ismim Sirli Foydalanuvchi va kompaniyam MAXFIYKOMP ishlayman");
    completeCalls = [];
    const a = await mk(c, "it");
    queue = ["Tayyor.", OK];
    await req(`/api/agents/${a.id}/run`, "POST", { request: "Kod misoli yoz" }, c);
    const first = completeCalls[0]!;
    const seen = first.system + JSON.stringify(first.messages);
    expect(seen).not.toContain("MAXFIYKOMP");
    expect(seen).not.toContain("Sirli");
    expect(first.messages).toHaveLength(1);
    expect(first.messages[0]!.content).toContain("Kod misoli yoz");
  });

  it("vazifa pasporti brief ichiga kiradi; boshqaning vazifasi 404", async () => {
    const a1 = await signup("a@example.com");
    const b1 = await signup("b@example.com");
    const t = (await (await req("/api/tasks", "POST", { title: "Kampaniya", goal: "Yangi mahsulot" }, a1)).json()).task;
    await req(`/api/tasks/${t.id}/items`, "POST", { stage: 1, text: "Auditoriya tahlili" }, a1);
    const ag = await mk(a1, "marketing");
    queue = ["Reja.", OK];
    expect((await req(`/api/agents/${ag.id}/run`, "POST", { request: "Post yoz", taskId: t.id }, a1)).status).toBe(201);
    const brief = completeCalls[0]!.messages[0]!.content;
    expect(brief).toContain("Yangi mahsulot");
    expect(brief).toContain("[ ] Auditoriya tahlili");
    const bag = await mk(b1, "hr");
    expect((await req(`/api/agents/${bag.id}/run`, "POST", { request: "Post yoz", taskId: t.id }, b1)).status).toBe(404);
    expect((await req(`/api/agents/${ag.id}/run`, "POST", { request: "Post yoz" }, b1)).status).toBe(404);
    expect((await req(`/api/agents/${ag.id}`, "DELETE", undefined, b1)).status).toBe(404);
    expect((await req(`/api/agents/${ag.id}/runs`, "GET", undefined, b1)).status).toBe(404);
  });

  it("tekshiruv yiqilsa ish saqlanadi (tekshirilmadi); agent yiqilsa xato", async () => {
    const c = await signup("a@example.com");
    const a = await mk(c);
    queue = ["Natija bor.", new Error("x")];
    const r = await (await req(`/api/agents/${a.id}/run`, "POST", { request: "Biror ish qil" }, c)).json();
    expect(r.run.verdict).toBe("unchecked");
    queue = [new Error("main yiqildi"), "Zaxira natija", OK];
    const fb = await (await req(`/api/agents/${a.id}/run`, "POST", { request: "Biror ish qil" }, c)).json();
    expect(fb.run).toMatchObject({ result: "Zaxira natija", model: "gemini-3.5-flash-lite" });
    queue = [new LlmHttpError(429), new LlmHttpError(429)];
    expect((await req(`/api/agents/${a.id}/run`, "POST", { request: "Biror ish qil" }, c)).status).toBe(429);
    queue = [new Error("boom")];
    expect((await req(`/api/agents/${a.id}/run`, "POST", { request: "Biror ish qil" }, c)).status).toBe(503);
    queue = ["   "];
    expect((await req(`/api/agents/${a.id}/run`, "POST", { request: "Biror ish qil" }, c)).status).toBe(503);
    expect((await req(`/api/agents/${a.id}/run`, "POST", { request: "x" }, c)).status).toBe(400);
  });

  it("brief va tekshiruv javobini ajratish", () => {
    expect(buildBrief("Salom", null)).toBe("TOPSHIRIQ:\nSalom");
    expect(buildBrief("x".repeat(9000), null).length).toBe(6000);
    expect(parseReview('{"verdict":"needs_work","notes":"Raqam to\'qilgan"}')).toEqual({ verdict: "needs_work", notes: "Raqam to'qilgan" });
    expect(parseReview("json emas").verdict).toBe("unchecked");
    expect(parseReview('{"verdict":"zo\'r"}').verdict).toBe("unchecked");
  });
});
