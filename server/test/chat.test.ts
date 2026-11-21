import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { GeminiProvider } from "../src/llm/gemini.js";
import { costUsd } from "../src/llm/pricing.js";
import { pickTier } from "../src/llm/router.js";
import { LlmHttpError, type LlmEvent, type LlmMessage, type LlmProvider } from "../src/llm/types.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";
import { normalizeHistory } from "../src/routes/chat.js";

const ORIGIN = "https://doda.tajriba24.uz";
const PASS = "correct-horse-battery";

interface Call { model: string; system: string; messages: LlmMessage[] }
let calls: Call[];
let behavior: (c: Call) => AsyncIterable<LlmEvent>;
let db: Db;
let mailer: MemoryMailer;
let app: ReturnType<typeof createApp>;
let clock: number;

const ok = (parts: string[], tin = 100, tout = 50): ((c: Call) => AsyncIterable<LlmEvent>) =>
  async function* () {
    for (const p of parts) yield { type: "delta", text: p };
    yield { type: "usage", tokensIn: tin, tokensOut: tout };
  };

const fake: LlmProvider = {
  complete: async () => ({ text: '{"facts": []}', tokensIn: 0, tokensOut: 0 }),
  stream: (p) => {
    const c = { model: p.model, system: p.system, messages: p.messages.map((m) => ({ ...m })) };
    calls.push(c);
    return behavior(c);
  },
};

function build(env: Record<string, string> = {}, llm: LlmProvider | null = fake) {
  db = openDb(":memory:");
  mailer = new MemoryMailer();
  calls = [];
  clock = Date.UTC(2026, 10, 21, 12, 0, 0);
  behavior = ok(["Salom, ", "dunyo"]);
  app = createApp({
    config: loadConfig({ NODE_ENV: "test", ...env }),
    db,
    mailer,
    llm,
    now: () => clock,
    limiter: new RateLimiter(() => clock),
  });
}

const json = (path: string, body: unknown, headers: Record<string, string> = {}, method = "POST") =>
  app.request(path, { method, headers: { "content-type": "application/json", origin: ORIGIN, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

async function signup(email: string): Promise<string> {
  await json("/api/auth/register", { email, password: PASS, locale: "uz", consents: { terms: true, personalData: true, crossBorder: true, voice: false } });
  const mail = [...mailer.outbox].reverse().find((m) => m.to === email)!;
  await json("/api/auth/verify-email", { token: mail.text.match(/token=([\w-]+)/)![1] });
  const res = await json("/api/auth/login", { email, password: PASS });
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}

interface Sse { event: string; data: any }
function parseSse(text: string): Sse[] {
  return text
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const ev = /^event: (.+)$/m.exec(b)?.[1] ?? "message";
      const data = /^data: (.+)$/m.exec(b)?.[1] ?? "null";
      return { event: ev, data: JSON.parse(data) };
    });
}

async function chat(cookie: string, message: string, conversationId?: string) {
  const res = await json("/api/chat", { message, ...(conversationId ? { conversationId } : {}) }, { cookie });
  return { res, events: res.headers.get("content-type")?.includes("text/event-stream") ? parseSse(await res.text()) : [] };
}

beforeEach(() => build());

describe("suhbat", () => {
  it("kirishsiz rad etiladi", async () => {
    expect((await json("/api/chat", { message: "salom" })).status).toBe(401);
  });

  it("kalit sozlanmagan bo'lsa 503", async () => {
    build({}, null);
    const cookie = await signup("a@example.com");
    expect((await json("/api/chat", { message: "salom" }, { cookie })).status).toBe(503);
  });

  it("javob oqim bilan keladi, xabarlar va sarf saqlanadi", async () => {
    const cookie = await signup("a@example.com");
    const { res, events } = await chat(cookie, "Salom DODA");
    expect(res.status).toBe(200);
    expect(events.map((e) => e.event)).toEqual(["meta", "delta", "delta", "done"]);
    expect(events[1]!.data.text + events[2]!.data.text).toBe("Salom, dunyo");
    const convId = events[0]!.data.conversationId;

    const msgs = db.prepare("SELECT role, content FROM messages ORDER BY id").all();
    expect(msgs).toEqual([
      { role: "user", content: "Salom DODA" },
      { role: "assistant", content: "Salom, dunyo" },
    ]);
    const u = db.prepare("SELECT model, tokens_in, tokens_out, cost_usd FROM usage").get() as any;
    expect(u.tokens_in).toBe(100);
    expect(u.tokens_out).toBe(50);
    expect(u.cost_usd).toBeCloseTo(costUsd(u.model, 100, 50, clock), 10);

    const list = await (await app.request("/api/conversations", { headers: { cookie } })).json();
    expect(list.conversations).toHaveLength(1);
    expect(list.conversations[0].id).toBe(convId);
    const detail = await (await app.request(`/api/conversations/${convId}`, { headers: { cookie } })).json();
    expect(detail.messages).toHaveLength(2);
  });

  it("tarix keyingi so'rovga yuboriladi (xotira) va tizim ko'rsatmasi foydalanuvchi tilida", async () => {
    const cookie = await signup("a@example.com");
    const first = await chat(cookie, "Mening ismim Hikmatullo");
    const convId = first.events[0]!.data.conversationId;
    await chat(cookie, "Mening ismim nima?", convId);
    const second = calls[1]!;
    expect(second.messages.map((m) => m.content)).toEqual(["Mening ismim Hikmatullo", "Salom, dunyo", "Mening ismim nima?"]);
    expect(second.system).toContain("DODA");
    expect(second.system).toContain("O'zbek");
  });

  it("boshqa foydalanuvchi suhbatiga kirib bo'lmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const conv = (await chat(a, "sir")).events[0]!.data.conversationId;
    expect((await app.request(`/api/conversations/${conv}`, { headers: { cookie: b } })).status).toBe(404);
    expect((await json("/api/chat", { message: "x", conversationId: conv }, { cookie: b })).status).toBe(404);
    expect((await json(`/api/conversations/${conv}`, undefined, { cookie: b }, "DELETE")).status).toBe(404);
    expect((await (await app.request("/api/conversations", { headers: { cookie: b } })).json()).conversations).toHaveLength(0);
  });

  it("suhbatni o'chirish xabarlarni ham o'chiradi", async () => {
    const cookie = await signup("a@example.com");
    const conv = (await chat(cookie, "salom")).events[0]!.data.conversationId;
    expect((await json(`/api/conversations/${conv}`, undefined, { cookie }, "DELETE")).status).toBe(200);
    expect(db.prepare("SELECT COUNT(*) c FROM messages").get()).toEqual({ c: 0 });
  });

  it("akkaunt o'chirilganda suhbat, xabar va sarf yozuvlari ham o'chadi", async () => {
    const cookie = await signup("a@example.com");
    await chat(cookie, "salom");
    expect((await json("/api/account", undefined, { cookie }, "DELETE")).status).toBe(200);
    for (const t of ["conversations", "messages", "usage"]) expect(db.prepare(`SELECT COUNT(*) c FROM ${t}`).get()).toEqual({ c: 0 });
  });

  it("noto'g'ri kirishlar rad etiladi", async () => {
    const cookie = await signup("a@example.com");
    expect((await json("/api/chat", { message: "" }, { cookie })).status).toBe(400);
    expect((await json("/api/chat", { message: "x".repeat(4001) }, { cookie })).status).toBe(400);
    expect((await json("/api/chat", { message: "x", conversationId: "nope" }, { cookie })).status).toBe(400);
  });
});

describe("model yo'naltirgich (token tejash)", () => {
  it("qisqa savol arzon modelga, murakkab ish asosiy modelga", async () => {
    const cookie = await signup("a@example.com");
    await chat(cookie, "Salom, qalaysan?");
    await chat(cookie, "Menga marketing strategiya tuzib ber");
    expect(calls[0]!.model).toBe("gemini-3.5-flash-lite");
    expect(calls[1]!.model).toBe("gemini-3.8-flash");
  });

  it("pickTier qoidalari", () => {
    expect(pickTier("Rahmat", 0)).toBe("light");
    expect(pickTier("x".repeat(401), 0)).toBe("main");
    expect(pickTier("```js\nlet a=1\n```", 0)).toBe("main");
    expect(pickTier("Составь план", 0)).toBe("main");
    expect(pickTier("x".repeat(200), 20)).toBe("main");
  });
});

describe("sarf limiti", () => {
  it("oylik limitga yetgach rad etiladi va model chaqirilmaydi", async () => {
    build({ MONTHLY_BUDGET_USD: "0.0001" });
    const cookie = await signup("a@example.com");
    expect((await chat(cookie, "salom")).res.status).toBe(200);
    const before = calls.length;
    const r = await chat(cookie, "yana");
    expect(r.res.status).toBe(429);
    expect((await r.res.json()).error.code).toBe("budget_exceeded");
    expect(calls.length).toBe(before);
  });

  it("limit keyingi oyda yangilanadi", async () => {
    build({ MONTHLY_BUDGET_USD: "0.0001" });
    const cookie = await signup("a@example.com");
    await chat(cookie, "salom");
    clock = Date.UTC(2026, 11, 2);
    expect((await chat(cookie, "yana")).res.status).toBe(200);
  });

  it("/api/usage oylik sarfni ko'rsatadi", async () => {
    const cookie = await signup("a@example.com");
    await chat(cookie, "salom");
    const u = await (await app.request("/api/usage", { headers: { cookie } })).json();
    expect(u.budgetUsd).toBe(5);
    expect(u.monthUsd).toBeGreaterThan(0);
    expect(u.tokensIn).toBe(100);
  });

  it("narx hisobi: Gemini 3.8 Flash 2027-yil yanvaridan qimmatlashadi", () => {
    const dec = costUsd("gemini-3.8-flash", 1_000_000, 1_000_000, Date.UTC(2026, 11, 31));
    const jan = costUsd("gemini-3.8-flash", 1_000_000, 1_000_000, Date.UTC(2027, 0, 1));
    expect(dec).toBeCloseTo(0.75 + 3.75, 6);
    expect(jan).toBeCloseTo(1.5 + 7.5, 6);
    expect(costUsd("gemini-3.5-flash-lite", 1_000_000, 0, 0)).toBeCloseTo(0.3, 6);
  });

  it("foydalanuvchi chastota cheklovi (daqiqada 20)", async () => {
    const cookie = await signup("a@example.com");
    for (let i = 0; i < 20; i++) await chat(cookie, "salom " + i);
    expect((await chat(cookie, "yana")).res.status).toBe(429);
  });
});

describe("xatolar", () => {
  it("model yiqilsa: xato hodisasi, sarf yozilmaydi, so'rov 500 bermaydi", async () => {
    behavior = async function* () {
      throw new Error("gemini http 500");
    };
    const cookie = await signup("a@example.com");
    const { res, events } = await chat(cookie, "salom");
    expect(res.status).toBe(200);
    expect(events.map((e) => e.event)).toEqual(["meta", "error"]);
    expect(events[1]!.data.code).toBe("llm_unavailable");
    expect(db.prepare("SELECT COUNT(*) c FROM usage").get()).toEqual({ c: 0 });
  });

  it("javob o'rtasida uzilsa, kelgan qismi saqlanadi va xato bildiriladi", async () => {
    behavior = async function* () {
      yield { type: "delta", text: "Yarim" };
      throw new Error("network");
    };
    const cookie = await signup("a@example.com");
    const { events } = await chat(cookie, "salom");
    expect(events.map((e) => e.event)).toEqual(["meta", "delta", "error"]);
    expect(db.prepare("SELECT content FROM messages WHERE role='assistant'").get()).toEqual({ content: "Yarim" });
  });

  it("Google 429 (bepul chegara) tushunarli xabar bilan: 'llm_rate_limited'", async () => {
    behavior = async function* () {
      throw new LlmHttpError(429);
    };
    const cookie = await signup("a@example.com");
    const { events } = await chat(cookie, "salom");
    expect(events.map((e) => e.event)).toEqual(["meta", "error"]);
    expect(events[1]!.data.code).toBe("llm_rate_limited");
    expect(events[1]!.data.message).toContain("chegara");
    expect(db.prepare("SELECT COUNT(*) c FROM usage").get()).toEqual({ c: 0 });
  });

  it("bo'sh javob: 'llm_empty' xatosi, sarf yozilmaydi", async () => {
    behavior = async function* () {
      yield { type: "usage", tokensIn: 10, tokensOut: 0 };
    };
    const cookie = await signup("a@example.com");
    const { events } = await chat(cookie, "salom");
    expect(events.map((e) => e.event)).toEqual(["meta", "error"]);
    expect(events[1]!.data.code).toBe("llm_empty");
    expect(db.prepare("SELECT COUNT(*) c FROM usage").get()).toEqual({ c: 0 });
  });

  it("usage kelmasa, taxminiy baho yoziladi", async () => {
    behavior = async function* () {
      yield { type: "delta", text: "Javob matni" };
    };
    const cookie = await signup("a@example.com");
    await chat(cookie, "salom");
    const u = db.prepare("SELECT tokens_in, tokens_out FROM usage").get() as any;
    expect(u.tokens_in).toBeGreaterThan(0);
    expect(u.tokens_out).toBeGreaterThan(0);
  });
});

describe("kontekstni tayyorlash", () => {
  it("ketma-ket bir xil rollar birlashtiriladi, 'user' bilan boshlanadi", () => {
    const r = normalizeHistory([
      { role: "assistant", content: "eski" },
      { role: "user", content: "a" },
      { role: "user", content: "b" },
      { role: "assistant", content: "c" },
      { role: "user", content: "d" },
    ]);
    expect(r[0]!.role).toBe("user");
    expect(r.map((m) => m.content)).toEqual(["a\n\nb", "c", "d"]);
  });

  it("uzun tarix eng eskidan qisqartiriladi, oxirgi xabar saqlanadi", () => {
    const msgs: LlmMessage[] = [];
    for (let i = 0; i < 10; i++) msgs.push({ role: i % 2 ? "assistant" : "user", content: "x".repeat(1000) + i });
    const r = normalizeHistory(msgs, 3000);
    expect(r.length).toBeLessThan(10);
    expect(r.at(-1)!.content.endsWith("9")).toBe(true);
    expect(r[0]!.role).toBe("user");
  });
});

describe("GeminiProvider", () => {
  const sse = (chunks: object[]) =>
    new Response(new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(x)}\r\n\r\n`)); c.close(); } }), { status: 200 });

  it("so'rovni to'g'ri quradi va oqimni o'qiydi (fikrlash matni chiqarilmaydi, tokenlar yig'iladi)", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return sse([
        { candidates: [{ content: { parts: [{ text: "o'ylayapman", thought: true }] } }] },
        { candidates: [{ content: { parts: [{ text: "Salom" }] } }] },
        { candidates: [{ content: { parts: [{ text: " dunyo" }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 30 } },
      ]);
    }) as unknown as typeof fetch;
    const g = new GeminiProvider("SECRET-KEY", fetchFn);
    const out: LlmEvent[] = [];
    for await (const e of g.stream({ model: "gemini-3.5-flash-lite", system: "SYS", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }] })) out.push(e);
    expect(out).toEqual([
      { type: "delta", text: "Salom" },
      { type: "delta", text: " dunyo" },
      { type: "usage", tokensIn: 12, tokensOut: 35 },
    ]);
    expect(seen!.url).toContain("/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse");
    expect(seen!.url).not.toContain("SECRET-KEY");
    expect((seen!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("SECRET-KEY");
    const body = JSON.parse(seen!.init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("SYS");
    expect(body.contents.map((c: any) => c.role)).toEqual(["user", "model"]);
  });

  it("HTTP xatosida kalitni oshkor qilmaydigan xato beradi", async () => {
    const fetchFn = (async () => new Response("denied SECRET-KEY", { status: 403 })) as unknown as typeof fetch;
    const g = new GeminiProvider("SECRET-KEY", fetchFn);
    await expect((async () => { for await (const _ of g.stream({ model: "m", system: "s", messages: [] })) { /* */ } })()).rejects.toThrow("gemini http 403");
    await (async () => { try { for await (const _ of g.stream({ model: "m", system: "s", messages: [] })) { /* */ } } catch (e) { expect(String(e)).not.toContain("SECRET-KEY"); } })();
  });
});
