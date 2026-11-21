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

let sttText: string | Error;
let sttCalls: Array<{ model: string; mime: string; lang: string; data: string }>;
const fake: LlmProvider = {
  async transcribe(p) {
    sttCalls.push({ model: p.model, mime: p.mime, lang: p.lang, data: p.data });
    if (sttText instanceof Error) throw sttText;
    return { text: sttText, tokensIn: 300, tokensOut: 12 };
  },
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
  sttText = "Salom dunyo";
  sttCalls = [];
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

const AUDIO = Buffer.alloc(3000, 7).toString("base64");
const stt = (c: string, extra: object = {}) => req("/api/voice/transcribe", "POST", { mime: "audio/webm;codecs=opus", data: AUDIO, lang: "uz", ...extra }, c);
const giveVoice = (c: string) => req("/api/account/consents", "POST", { type: "voice", accepted: true }, c);

describe("ovozni matnga aylantirish", () => {
  it("kirishsiz rad etiladi", async () => {
    expect((await req("/api/voice/transcribe", "POST", { mime: "audio/webm", data: AUDIO })).status).toBe(401);
  });

  it("rozilik bo'lmasa 403 va model chaqirilmaydi; rozilikdan keyin ishlaydi", async () => {
    const c = await signup("a@example.com");
    expect((await stt(c)).status).toBe(403);
    expect(sttCalls).toHaveLength(0);
    await giveVoice(c);
    const res = await stt(c);
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe("Salom dunyo");
    expect(sttCalls[0]).toMatchObject({ model: "gemini-3.5-flash-lite", mime: "audio/webm", lang: "uz" });
  });

  it("sarf yoziladi, audio bazaga saqlanmaydi", async () => {
    const c = await signup("a@example.com");
    await giveVoice(c);
    await stt(c, { lang: "ru" });
    expect((await (await req("/api/usage", "GET", undefined, c)).json()).tokensIn).toBe(300);
    expect(sttCalls[0]!.lang).toBe("ru");
    const dump = JSON.stringify(db.prepare("SELECT * FROM messages").all()) + JSON.stringify(db.prepare("SELECT * FROM files").all());
    expect(dump).not.toContain(AUDIO.slice(0, 40));
  });

  it("noto'g'ri kirish rad etiladi", async () => {
    const c = await signup("a@example.com");
    await giveVoice(c);
    expect((await stt(c, { mime: "text/html" })).status).toBe(400);
    expect((await stt(c, { data: "qisqa" })).status).toBe(400);
    expect((await stt(c, { data: "<script>".repeat(30) })).status).toBe(400);
    expect((await stt(c, { lang: "en" })).status).toBe(400);
    expect((await stt(c, { data: "A".repeat(2_100_000) })).status).toBe(400);
  });

  it("model xatosi: asosiy modelga zaxira, 429 va 503", async () => {
    const c = await signup("a@example.com");
    await giveVoice(c);
    let n = 0;
    const orig = fake.transcribe;
    fake.transcribe = async (p) => { if (n++ === 0) throw new LlmHttpError(500); return orig(p); };
    const ok = await stt(c);
    fake.transcribe = orig;
    expect(ok.status).toBe(200);
    expect(sttCalls.at(-1)!.model).toBe("gemini-3.8-flash");
    sttText = new LlmHttpError(429);
    expect((await stt(c)).status).toBe(429);
    sttText = new Error("x");
    expect((await stt(c)).status).toBe(503);
  });

  it("chastota cheklovi: daqiqada 20", async () => {
    const c = await signup("a@example.com");
    await giveVoice(c);
    for (let i = 0; i < 20; i++) await stt(c);
    expect((await stt(c)).status).toBe(429);
  });
});
