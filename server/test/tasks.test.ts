import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { LlmHttpError, type LlmEvent, type LlmMessage, type LlmProvider } from "../src/llm/types.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";
import { parsePlan } from "../src/routes/tasks.js";

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

const PLAN = JSON.stringify({ title: "Sayt ochish", stages: [
  { name: "Tahlil", items: ["Bozorni o'rganish", "Raqobatchilar"] },
  { name: "Dizayn", items: ["Maket"] },
] });

describe("vazifalar", () => {
  it("kirishsiz rad etiladi", async () => {
    expect((await req("/api/tasks")).status).toBe(401);
  });

  it("qo'lda yaratish: 5 bosqich, qadam qo'shish, belgilash, hisob", async () => {
    const c = await signup("a@example.com");
    const t = (await (await req("/api/tasks", "POST", { title: "Reklama", goal: "Instagram" }, c)).json()).task;
    expect(t.stages).toHaveLength(5);
    const r1 = await (await req(`/api/tasks/${t.id}/items`, "POST", { stage: 2, text: "Post yozish" }, c)).json();
    const item = r1.task.stages[1].items[0];
    expect(item).toMatchObject({ text: "Post yozish", done: false });
    const r2 = await (await req(`/api/tasks/items/${item.id}`, "PATCH", { done: true }, c)).json();
    expect(r2.task.stages[1].items[0].done).toBe(true);
    const list = await (await req("/api/tasks", "GET", undefined, c)).json();
    expect(list.tasks[0]).toMatchObject({ title: "Reklama", total: 1, done: 1 });
    expect((await req(`/api/tasks/items/${item.id}`, "DELETE", undefined, c)).status).toBe(200);
  });

  it("nom, holat, bosqich nomini o'zgartirish; arxivlangan ro'yxatdan chiqadi", async () => {
    const c = await signup("a@example.com");
    const t = (await (await req("/api/tasks", "POST", { title: "A" }, c)).json()).task;
    const r = await (await req(`/api/tasks/${t.id}`, "PATCH", { title: "B", stages: [{ stage: 1, name: "Boshlash" }] }, c)).json();
    expect(r.task.title).toBe("B");
    expect(r.task.stages[0].name).toBe("Boshlash");
    await req(`/api/tasks/${t.id}`, "PATCH", { status: "archived" }, c);
    expect((await (await req("/api/tasks", "GET", undefined, c)).json()).tasks).toHaveLength(0);
  });

  it("DODA maqsaddan reja tuzadi va sarf yoziladi", async () => {
    const c = await signup("a@example.com");
    completeText = PLAN;
    const res = await req("/api/tasks/plan", "POST", { goal: "Kompaniya uchun sayt ochmoqchiman" }, c);
    expect(res.status).toBe(201);
    const t = (await res.json()).task;
    expect(t.title).toBe("Sayt ochish");
    expect(t.stages.map((s: any) => s.items.length)).toEqual([2, 1]);
    expect(completeCalls.at(-1)!.json).toBe(true);
    const u = await (await req("/api/usage", "GET", undefined, c)).json();
    expect(u.tokensIn).toBeGreaterThan(0);
  });

  it("noto'g'ri model javobi 400, xato 503/429", async () => {
    const c = await signup("a@example.com");
    completeText = "bu json emas";
    expect((await req("/api/tasks/plan", "POST", { goal: "Biror katta maqsad" }, c)).status).toBe(400);
    completeText = (() => { throw new LlmHttpError(429); }) as never;
    expect((await req("/api/tasks/plan", "POST", { goal: "Biror katta maqsad" }, c)).status).toBe(429);
    completeText = (() => { throw new Error("x"); }) as never;
    expect((await req("/api/tasks/plan", "POST", { goal: "Biror katta maqsad" }, c)).status).toBe(503);
  });

  it("boshqa foydalanuvchi vazifasiga kira olmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const t = (await (await req("/api/tasks", "POST", { title: "Maxfiy" }, a)).json()).task;
    const it = (await (await req(`/api/tasks/${t.id}/items`, "POST", { stage: 1, text: "x" }, a)).json()).task.stages[0].items[0];
    expect((await req(`/api/tasks/${t.id}`, "GET", undefined, b)).status).toBe(404);
    expect((await req(`/api/tasks/${t.id}`, "PATCH", { title: "Hack" }, b)).status).toBe(404);
    expect((await req(`/api/tasks/${t.id}`, "DELETE", undefined, b)).status).toBe(404);
    expect((await req(`/api/tasks/${t.id}/items`, "POST", { stage: 1, text: "y" }, b)).status).toBe(404);
    expect((await req(`/api/tasks/items/${it.id}`, "PATCH", { done: true }, b)).status).toBe(404);
    expect((await req(`/api/tasks/items/${it.id}`, "DELETE", undefined, b)).status).toBe(404);
    expect((await (await req("/api/tasks", "GET", undefined, b)).json()).tasks).toHaveLength(0);
  });

  it("noto'g'ri kirish rad etiladi", async () => {
    const c = await signup("a@example.com");
    expect((await req("/api/tasks", "POST", { title: "" }, c)).status).toBe(400);
    expect((await req("/api/tasks/plan", "POST", { goal: "qisqa" }, c)).status).toBe(400);
    const t = (await (await req("/api/tasks", "POST", { title: "A" }, c)).json()).task;
    expect((await req(`/api/tasks/${t.id}/items`, "POST", { stage: 6, text: "x" }, c)).status).toBe(400);
    expect((await req(`/api/tasks/${t.id}`, "PATCH", { status: "bad" }, c)).status).toBe(400);
  });

  it("parsePlan: ortiqcha qismlarni kesadi", () => {
    const p = parsePlan("```json\n" + JSON.stringify({ title: "T", stages: Array.from({ length: 8 }, (_, i) => ({ name: "S" + i, items: Array.from({ length: 12 }, () => "q") })) }) + "\n```")!;
    expect(p.stages).toHaveLength(5);
    expect(p.stages[0]!.items).toHaveLength(8);
    expect(parsePlan("{}")).toBeNull();
    expect(parsePlan('{"stages":[{"items":["x"]}]}')).toBeNull();
  });
});
