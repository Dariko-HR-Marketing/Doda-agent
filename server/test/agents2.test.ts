import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { LlmHttpError, type LlmEvent, type LlmMessage, type LlmProvider } from "../src/llm/types.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";
import { catalogFor, localized, recommendedIds, selectableIds, suggestTemplate } from "../src/catalog.js";

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

describe("katalog (DODA tavsiyasi)", () => {
  it("har bir rolda vazifalar, vositalar va holatlar bor; tavsiya etilganlar bor; 'tez orada' tanlanmaydi", () => {
    for (const id of ["marketing", "hr", "it", "sales", "analyst", "general"]) {
      const cat = catalogFor(id);
      expect(cat.groups.map((g) => g.id)).toEqual(["duties", "tools", "situations"]);
      for (const g of cat.groups) expect(g.items.length, id + g.id).toBeGreaterThanOrEqual(3);
      expect(recommendedIds(cat).length, id).toBeGreaterThan(4);
      const soon = cat.groups.flatMap((g) => g.items).filter((i) => i.status === "soon");
      for (const i of soon) expect(selectableIds(cat).has(i.id)).toBe(false);
      const ids = cat.groups.flatMap((g) => g.items.map((i) => i.id));
      expect(new Set(ids).size, "takror id " + id).toBe(ids.length);
    }
    const mkt = catalogFor("marketing");
    expect(mkt.groups[1]!.items.find((i) => i.id === "t_publish")).toMatchObject({ status: "soon", approval: true });
  });

  it("ikki tilda matn bor", () => {
    const uz = localized(catalogFor("hr"), "uz");
    const ru = localized(catalogFor("hr"), "ru");
    expect(uz.groups[0]!.items[0]!.label).not.toBe(ru.groups[0]!.items[0]!.label);
  });

  it("matndan rolni taxmin qilish", () => {
    expect(suggestTemplate("Instagram uchun reklama va kontent")).toBe("marketing");
    expect(suggestTemplate("Нужен специалист по найму сотрудников")).toBe("hr");
    expect(suggestTemplate("server va kod bilan ishlaydi")).toBe("it");
    expect(suggestTemplate("qandaydir boshqa ish")).toBe("general");
  });

  it("API: tavsiya, rolga ko'ra katalog, taxmin", async () => {
    const c = await signup("a@example.com");
    const r = await (await req("/api/agents/catalog?template=marketing", "GET", undefined, c)).json();
    expect(r.template).toBe("marketing");
    expect(r.catalog.groups).toHaveLength(3);
    expect(r.recommended).toContain("d_plan");
    expect(r.recommended).not.toContain("t_publish");
    const s = await (await req("/api/agents/catalog?q=" + encodeURIComponent("hr xodim yollash"), "GET", undefined, c)).json();
    expect(s).toMatchObject({ template: "hr", suggested: true });
  });
});

describe("imkoniyatlarni tanlash", () => {
  it("tanlov berilmasa tavsiya qo'llanadi; tanlov berilsa aynan shu saqlanadi", async () => {
    const c = await signup("a@example.com");
    const a1 = await mk(c);
    expect(a1.capabilities).toEqual(recommendedIds(catalogFor("marketing")));
    const a2 = await mk(c, "marketing", { capabilities: ["d_plan", "t_text"], name: "Mening SMM", custom: [{ group: "duties", text: "Telegram kanal yuritish" }] });
    expect(a2).toMatchObject({ name: "Mening SMM", capabilities: ["d_plan", "t_text"] });
    expect(a2.custom).toEqual([{ group: "duties", text: "Telegram kanal yuritish" }]);
  });

  it("noto'g'ri id, 'tez orada' vosita, takror, maxfiy matn rad etiladi", async () => {
    const c = await signup("a@example.com");
    const bad = (extra: object) => req("/api/agents", "POST", { template: "marketing", ...extra }, c);
    expect((await bad({ capabilities: ["yo'q-id"] })).status).toBe(400);
    expect((await bad({ capabilities: ["t_publish"] })).status).toBe(400);
    expect((await bad({ capabilities: ["d_plan", "d_plan"] })).status).toBe(400);
    expect((await bad({ capabilities: ["d_plan"], custom: [{ group: "duties", text: "parolni yoz: parol 123" }] })).status).toBe(400);
    expect((await bad({ capabilities: ["d_it_boshqa_rol"] })).status).toBe(400); // boshqa rol id si
  });

  it("tahrirlash: imkoniyatlarni almashtirish", async () => {
    const c = await signup("a@example.com");
    const a = await mk(c);
    const r = await (await req(`/api/agents/${a.id}`, "PATCH", { capabilities: ["d_seo"] }, c)).json();
    expect(r.agent.capabilities).toEqual(["d_seo"]);
    expect((await req(`/api/agents/${a.id}`, "PATCH", { capabilities: ["x"] }, c)).status).toBe(400);
  });

  it("o'z agentingiz (shablonsiz): umumiy katalogdan tanlaydi", async () => {
    const c = await signup("a@example.com");
    const r = await req("/api/agents", "POST", { name: "Yurist", role: "Shartnomalar", instructions: "Sen yuristsan.", capabilities: ["d_write", "d_check"] }, c);
    expect(r.status).toBe(201);
    expect((await (await req("/api/agents", "POST", { name: "Y2", role: "r", instructions: "i", capabilities: ["d_seo"] }, c)).json()).error).toBeDefined();
  });
});

describe("agent xotirasi", () => {
  it("qo'shish, ro'yxat, o'chirish, takrorlanmaydi, maxfiy rad, chegara", async () => {
    const c = await signup("a@example.com");
    const a = await mk(c);
    await req(`/api/agents/${a.id}/memory`, "POST", { kind: "lesson", text: "Mijoz rasmiy ohangni yoqtiradi" }, c);
    await req(`/api/agents/${a.id}/memory`, "POST", { kind: "lesson", text: "mijoz rasmiy ohangni yoqtiradi" }, c);
    const list = (await (await req(`/api/agents/${a.id}/memory`, "GET", undefined, c)).json()).memory;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "lesson", text: "Mijoz rasmiy ohangni yoqtiradi" });
    expect((await req(`/api/agents/${a.id}/memory`, "POST", { text: "mening parolim 12345" }, c)).status).toBe(400);
    expect((await req(`/api/agents/${a.id}/memory`, "POST", { kind: "xato", text: "Bu yaroqsiz tur" }, c)).status).toBe(400);
    expect((await req(`/api/agents/${a.id}/memory/${list[0].id}`, "DELETE", undefined, c)).status).toBe(200);
    for (let i = 0; i < 100; i++) await req(`/api/agents/${a.id}/memory`, "POST", { text: "Fakt raqami " + i + " yozildi" }, c);
    expect((await req(`/api/agents/${a.id}/memory`, "POST", { text: "Yuz birinchi fakt yozuvi" }, c)).status).toBe(400);
    expect((await (await req("/api/agents", "GET", undefined, c)).json()).agents[0].memoryCount).toBe(100);
  });

  it("boshqa foydalanuvchi agent xotirasiga kira olmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const ag = await mk(a);
    expect((await req(`/api/agents/${ag.id}/memory`, "GET", undefined, b)).status).toBe(404);
    expect((await req(`/api/agents/${ag.id}/memory`, "POST", { text: "Begona yozuv yoziladi" }, b)).status).toBe(404);
  });
});

describe("to-do ro'yxatlari", () => {
  it("DODA ro'yxati va agent ro'yxati alohida; belgilash, tahrir, ustuvorlik, tozalash", async () => {
    const c = await signup("a@example.com");
    const ag = await mk(c);
    await req("/api/todos", "POST", { text: "Shartnoma imzolash" }, c);
    await req("/api/todos", "POST", { agent: ag.id, text: "Post matnini yozish", priority: true }, c);
    const doda = (await (await req("/api/todos?agent=doda", "GET", undefined, c)).json()).todos;
    const agt = (await (await req(`/api/todos?agent=${ag.id}`, "GET", undefined, c)).json()).todos;
    expect(doda.map((t: any) => t.text)).toEqual(["Shartnoma imzolash"]);
    expect(agt.map((t: any) => [t.text, t.priority])).toEqual([["Post matnini yozish", true]]);
    const done = await (await req(`/api/todos/${agt[0].id}`, "PATCH", { done: true, text: "Post yozildi" }, c)).json();
    expect(done.todos[0]).toMatchObject({ done: true, text: "Post yozildi" });
    expect((await (await req("/api/agents", "GET", undefined, c)).json()).agents[0].openTodos).toBe(0);
    const cleared = await (await req(`/api/todos?agent=${ag.id}`, "DELETE", undefined, c)).json();
    expect(cleared.todos).toEqual([]);
  });

  it("xavfsizlik: boshqa foydalanuvchi ro'yxatiga tegolmaydi; agent o'chsa ro'yxati ham o'chadi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const ag = await mk(a);
    const t = (await (await req("/api/todos", "POST", { agent: ag.id, text: "Maxfiy vazifa" }, a)).json()).todos[0];
    expect((await req(`/api/todos?agent=${ag.id}`, "GET", undefined, b)).status).toBe(404);
    expect((await req("/api/todos", "POST", { agent: ag.id, text: "Hujum" }, b)).status).toBe(404);
    expect((await req(`/api/todos/${t.id}`, "PATCH", { done: true }, b)).status).toBe(404);
    expect((await req(`/api/todos/${t.id}`, "DELETE", undefined, b)).status).toBe(404);
    await req(`/api/agents/${ag.id}`, "DELETE", undefined, a);
    expect(db.prepare("SELECT COUNT(*) c FROM todos").get()).toEqual({ c: 0 });
    expect((await req("/api/todos", "POST", { text: "" }, a)).status).toBe(400);
  });

  it("chegara: 200 ta", async () => {
    const c = await signup("a@example.com");
    for (let i = 0; i < 200; i++) await req("/api/todos", "POST", { text: "vazifa " + i }, c);
    expect((await req("/api/todos", "POST", { text: "ortiqcha" }, c)).status).toBe(400);
  });
});

describe("DODA xotirasi (bosh agent)", () => {
  it("faktlarni ko'rish, qo'shish, o'chirish; maxfiy rad", async () => {
    const c = await signup("a@example.com");
    expect((await (await req("/api/doda/memory", "GET", undefined, c)).json()).facts).toEqual([]);
    await req("/api/doda/memory", "POST", { text: "Kompaniyam nomi DARIKO" }, c);
    const r = await (await req("/api/doda/memory", "POST", { text: "Ofis Toshkentda joylashgan" }, c)).json();
    expect(r.facts.map((f: any) => f.text)).toEqual(["Kompaniyam nomi DARIKO", "Ofis Toshkentda joylashgan"]);
    expect((await req("/api/doda/memory", "POST", { text: "Kompaniyam nomi DARIKO" }, c)).status).toBe(201); // takror qo'shilmaydi
    expect((await (await req("/api/doda/memory", "GET", undefined, c)).json()).facts).toHaveLength(2);
    expect((await req("/api/doda/memory", "POST", { text: "mening parolim juda sirli" }, c)).status).toBe(400);
    const d = await (await req("/api/doda/memory/0", "DELETE", undefined, c)).json();
    expect(d.facts.map((f: any) => f.text)).toEqual(["Ofis Toshkentda joylashgan"]);
    expect((await req("/api/doda/memory/9", "DELETE", undefined, c)).status).toBe(404);
  });
});

describe("agent ishga tushganda kontekst", () => {
  it("tanlangan imkoniyatlar, o'z xotirasi va ochiq to-do tizim ko'rsatmasiga kiradi; boshqa agent xotirasi kirmaydi", async () => {
    const c = await signup("a@example.com");
    const mkt = await mk(c, "marketing", { capabilities: ["d_plan", "t_text", "s_launch"] });
    const other = await mk(c, "hr");
    await req(`/api/agents/${mkt.id}/memory`, "POST", { kind: "preference", text: "Har doim qisqa va rasmiy yozing" }, c);
    await req(`/api/agents/${other.id}/memory`, "POST", { kind: "fact", text: "HR agentning maxfiy xotirasi" }, c);
    await req("/api/todos", "POST", { agent: mkt.id, text: "Dushanba uchun post tayyorlash" }, c);
    await req("/api/todos", "POST", { agent: other.id, text: "Nomzodlarni chaqirish" }, c);
    await req("/api/doda/memory", "POST", { text: "DODA ning shaxsiy fakti sirli" }, c);
    queue = ["Reja tayyor.", OK];
    completeCalls.length = 0;
    expect((await req(`/api/agents/${mkt.id}/run`, "POST", { request: "Oylik reja tuz" }, c)).status).toBe(201);
    const sys = completeCalls[0]!.system;
    expect(sys).toContain("Kontent-reja tuzish");
    expect(sys).toContain("Yangi mahsulot yoki xizmat chiqishi");
    expect(sys).toContain("Har doim qisqa va rasmiy yozing");
    expect(sys).toContain("Dushanba uchun post tayyorlash");
    expect(sys).not.toContain("Post va reklama matnlari"); // tanlanmagan vazifa
    expect(sys).not.toContain("HR agentning maxfiy xotirasi");
    expect(sys).not.toContain("Nomzodlarni chaqirish");
    expect(sys).not.toContain("DODA ning shaxsiy fakti");
  });
});

describe("DODA marshrutizatori (AI siz)", () => {
  const route = async (c: string, text: string) => (await (await req("/api/agents/route", "POST", { text }, c)).json());

  it("kirishsiz va qisqa matn rad etiladi", async () => {
    expect((await req("/api/agents/route", "POST", { text: "reja tuz" })).status).toBe(401);
    const c = await signup("a@example.com");
    expect((await req("/api/agents/route", "POST", { text: "ab" }, c)).status).toBe(400);
  });

  it("topshiriqni mos agentga yo'naltiradi (uzbekcha va ruscha)", async () => {
    const c = await signup("a@example.com");
    const mkt = await mk(c, "marketing");
    const hr = await mk(c, "hr");
    const it = await mk(c, "it");
    const r1 = await route(c, "Instagram uchun oylik kontent-reja va post matnlari tuzing");
    expect(r1.match.agentId).toBe(mkt.id);
    expect(r1.match.confidence).toBe("high");
    expect(r1.create).toBeNull();
    expect((await route(c, "Menejer uchun vakansiya matni va suhbat savollari kerak")).match.agentId).toBe(hr.id);
    expect((await route(c, "Нужно найти ошибку в коде сервера")).match.agentId).toBe(it.id);
    expect((await route(c, "Составь контент-план для рекламы в Instagram")).match.agentId).toBe(mkt.id);
  });

  it("mos agent yo'q bo'lsa, yaratishni tavsiya qiladi (DODA tavsiyasi bilan)", async () => {
    const c = await signup("a@example.com");
    const r = await route(c, "Mijozga tijoriy taklif va narx bo'yicha xat yozish kerak");
    expect(r.match).toBeNull();
    expect(r.create.template).toBe("sales");
    expect(r.create.recommended).toContain("d_offer");
    await mk(c, "marketing");
    const r2 = await route(c, "Rezyume saralash va vakansiya matnlari");
    expect(r2.match).toBeNull();
    expect(r2.create.template).toBe("hr");
  });

  it("umumiy gap: agent ham, yaratish ham tavsiya qilinmaydi (DODA o'zi javob beradi)", async () => {
    const c = await signup("a@example.com");
    await mk(c, "marketing");
    const r = await route(c, "Salom, ahvollar qalay bugun");
    expect(r).toEqual({ match: null, alternatives: [], create: null });
  });

  it("agentning o'z imkoniyatlari va qo'shimcha bandlari hisobga olinadi", async () => {
    const c = await signup("a@example.com");
    await mk(c, "analyst", { capabilities: ["d_summary"] });
    const own = await mk(c, "marketing", { name: "Mening Telegram agentim", capabilities: ["d_plan"], custom: [{ group: "duties", text: "Telegram kanal obunachilarini oshirish" }] });
    const r = await route(c, "Telegram kanal obunachilarini oshirish yo'llari");
    expect(r.match.agentId).toBe(own.id);
  });

  it("boshqa foydalanuvchi agentlari hisobga olinmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    await mk(a, "marketing");
    const r = await route(b, "Instagram uchun kontent-reja tuzing");
    expect(r.match).toBeNull();
    expect(r.create.template).toBe("marketing");
  });
});

describe("vazifani agentga topshirish", () => {
  it("DODA ro'yxatidagi vazifa agent ro'yxatiga o'tadi; teskari ham; begona agentga bo'lmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const ag = await mk(a, "marketing");
    const bag = await mk(b, "hr");
    const t = (await (await req("/api/todos", "POST", { text: "Post matnini tayyorlash" }, a)).json()).todos[0];
    const after = await (await req(`/api/todos/${t.id}`, "PATCH", { agent: ag.id }, a)).json();
    expect(after.todos).toEqual([]); // DODA ro'yxatidan chiqdi
    const agt = (await (await req(`/api/todos?agent=${ag.id}`, "GET", undefined, a)).json()).todos;
    expect(agt.map((x: any) => x.text)).toEqual(["Post matnini tayyorlash"]);
    expect((await req(`/api/todos/${t.id}`, "PATCH", { agent: bag.id }, a)).status).toBe(404);
    const back = await (await req(`/api/todos/${t.id}`, "PATCH", { agent: "doda" }, a)).json();
    expect(back.todos).toEqual([]); // agent ro'yxatidan chiqdi
    expect((await (await req("/api/todos?agent=doda", "GET", undefined, a)).json()).todos).toHaveLength(1);
    expect((await req(`/api/todos/${t.id}`, "PATCH", { agent: "yo'q" }, a)).status).toBe(404);
  });
});
