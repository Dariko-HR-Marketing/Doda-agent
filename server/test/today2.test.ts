import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { LlmHttpError, type LlmEvent, type LlmMessage, type LlmProvider } from "../src/llm/types.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";

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

const mk = async (c: string, template = "marketing", extra: object = {}) => (await (await req("/api/agents", "POST", { template, ...extra }, c)).json()).agent;
const add = async (c: string, body: object) => (await (await req("/api/todos", "POST", body, c)).json()).todos;

describe("to-do muddati va takrorlanishi", () => {
  it("muddat bilan yaratish, tartib (muddatlilar oldin), tahrir, olib tashlash", async () => {
    const c = await signup("a@example.com");
    await add(c, { text: "Muddatsiz" });
    await add(c, { text: "Keyinroq", due: "2026-12-01" });
    const todos = await add(c, { text: "Avvalroq", due: "2026-11-25" });
    expect(todos.map((t: any) => t.text)).toEqual(["Avvalroq", "Keyinroq", "Muddatsiz"]);
    expect(todos[0]).toMatchObject({ due: "2026-11-25", repeat: "none" });
    const upd = await (await req(`/api/todos/${todos[2].id}`, "PATCH", { due: "2026-11-20" }, c)).json();
    expect(upd.todos[0].text).toBe("Muddatsiz");
    const clr = await (await req(`/api/todos/${todos[2].id}`, "PATCH", { due: null }, c)).json();
    expect(clr.todos.find((t: any) => t.text === "Muddatsiz").due).toBeNull();
  });

  it("noto'g'ri sana va muddatsiz takrorlanish rad etiladi", async () => {
    const c = await signup("a@example.com");
    expect((await req("/api/todos", "POST", { text: "x", due: "2026-02-30" }, c)).status).toBe(400);
    expect((await req("/api/todos", "POST", { text: "x", repeat: "daily" }, c)).status).toBe(400);
    expect((await req("/api/todos", "POST", { text: "x", repeat: "yearly", due: "2026-11-22" }, c)).status).toBe(400);
    const t = (await add(c, { text: "Oddiy" }))[0];
    expect((await req(`/api/todos/${t.id}`, "PATCH", { repeat: "weekly" }, c)).status).toBe(400);
  });

  it("takroriy vazifa bajarilsa, keyingisi yaratiladi (bugundan oldin emas); takrorlanmaydigani yaratilmaydi", async () => {
    const c = await signup("a@example.com");
    const t = (await add(c, { text: "Haftalik hisobot", due: "2026-11-02", repeat: "weekly" }))[0];
    const after = await (await req(`/api/todos/${t.id}`, "PATCH", { done: true, today: "2026-11-22" }, c)).json();
    const open = after.todos.filter((x: any) => !x.done);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ text: "Haftalik hisobot", due: "2026-11-23", repeat: "weekly" }); // 11-09, 11-16, 11-23: birinchi kelajak sanasi
    // bir marta belgilangan vazifani qayta belgilash yangisini ko'paytirmaydi
    await req(`/api/todos/${t.id}`, "PATCH", { done: true, today: "2026-11-22" }, c);
    expect((await (await req("/api/todos?agent=doda", "GET", undefined, c)).json()).todos.filter((x: any) => !x.done)).toHaveLength(1);
    const one = (await add(c, { text: "Bir martalik", due: "2026-11-22" })).find((x: any) => x.text === "Bir martalik");
    const r = await (await req(`/api/todos/${one.id}`, "PATCH", { done: true }, c)).json();
    expect(r.todos.filter((x: any) => !x.done && x.text === "Bir martalik")).toHaveLength(0);
  });

  it("agent ro'yxatidagi takroriy vazifa o'z agentida qoladi", async () => {
    const c = await signup("a@example.com");
    const ag = await mk(c);
    const t = (await add(c, { agent: ag.id, text: "Kunlik post", due: "2026-11-22", repeat: "daily" }))[0];
    await req(`/api/todos/${t.id}`, "PATCH", { done: true, today: "2026-11-22" }, c);
    const list = (await (await req(`/api/todos?agent=${ag.id}`, "GET", undefined, c)).json()).todos;
    expect(list.filter((x: any) => !x.done).map((x: any) => x.due)).toEqual(["2026-11-23"]);
    expect((await (await req("/api/todos?agent=doda", "GET", undefined, c)).json()).todos).toEqual([]);
  });
});

describe("Bugun paneli", () => {
  it("kirishsiz rad etiladi; noto'g'ri sana 400", async () => {
    expect((await req("/api/today")).status).toBe(401);
    const c = await signup("a@example.com");
    expect((await req("/api/today?d=2026-99-99", "GET", undefined, c)).status).toBe(400);
  });

  it("diqqat talab qiladiganlar (kechikkan, bugun, muhim), hisoblar, vazifalar, agentlar, oxirgi ishlar", async () => {
    const c = await signup("a@example.com");
    const ag = await mk(c, "marketing", { name: "SMM" });
    await add(c, { text: "Kechikkan", due: "2026-11-20" });
    await add(c, { text: "Bugungi", due: "2026-11-22", agent: ag.id });
    await add(c, { text: "Keyinroq", due: "2026-11-30" });
    await add(c, { text: "Muhim muddatsiz", priority: true });
    await add(c, { text: "Oddiy muddatsiz" });
    const dn = (await add(c, { text: "Bajarilgan", due: "2026-11-20" })).find((x: any) => x.text === "Bajarilgan");
    await req(`/api/todos/${dn.id}`, "PATCH", { done: true }, c);
    await req("/api/tasks", "POST", { title: "Sayt ochish" }, c);
    const r = await (await req("/api/today?d=2026-11-22", "GET", undefined, c)).json();
    expect(r.date).toBe("2026-11-22");
    expect(r.counts).toEqual({ open: 5, overdue: 1, today: 1, done: 1 });
    expect(r.attention.map((t: any) => t.text)).toEqual(["Kechikkan", "Bugungi", "Muhim muddatsiz"]);
    expect(r.attention[1]).toMatchObject({ agentId: ag.id, agentName: "SMM" });
    expect(r.tasks.map((t: any) => t.title)).toEqual(["Sayt ochish"]);
    expect(r.agents[0]).toMatchObject({ name: "SMM", openTodos: 1 });
    expect(r.runs).toEqual([]);
    expect(r.usage).toEqual({ monthUsd: 0, ownUsd: 0 });
  });

  it("boshqa foydalanuvchi ma'lumotlari ko'rinmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    await mk(a);
    await add(a, { text: "Maxfiy", due: "2026-11-01" });
    const r = await (await req("/api/today?d=2026-11-22", "GET", undefined, b)).json();
    expect(r.attention).toEqual([]);
    expect(r.agents).toEqual([]);
    expect(r.counts.open).toBe(0);
  });
});
