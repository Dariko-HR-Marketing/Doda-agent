import { mkdtempSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { backupDb } from "../src/backup.js";
import { loadConfig } from "../src/config.js";
import { openDb, type Db } from "../src/db.js";
import { MemoryMailer } from "../src/mailer.js";
import { RateLimiter } from "../src/rateLimit.js";

const ORIGIN = "https://doda.tajriba24.uz";
const PASS = "correct-horse-battery";
let db: Db;
let mailer: MemoryMailer;
let app: ReturnType<typeof createApp>;
const clock = Date.UTC(2026, 10, 22, 12, 0, 0);

beforeEach(() => {
  db = openDb(":memory:");
  mailer = new MemoryMailer();
  app = createApp({ config: loadConfig({ NODE_ENV: "test" }), db, mailer, llm: null, now: () => clock, limiter: new RateLimiter(() => clock) });
});
const req = (path: string, method = "GET", body?: unknown, cookie = "") =>
  app.request(path, { method, headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function signup(email: string): Promise<string> {
  await req("/api/auth/register", "POST", { email, password: PASS, locale: "uz", consents: { terms: true, personalData: true, crossBorder: true, voice: true } });
  const mail = [...mailer.outbox].reverse().find((m) => m.to === email)!;
  await req("/api/auth/verify-email", "POST", { token: mail.text.match(/token=([\w-]+)/)![1] });
  const res = await req("/api/auth/login", "POST", { email, password: PASS });
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}

describe("ma'lumotlarni yuklab olish", () => {
  it("kirishsiz rad etiladi", async () => {
    expect((await req("/api/account/export")).status).toBe(401);
  });

  it("faqat o'zining ma'lumoti; parol hash va kalitlar kirmaydi", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    await req("/api/todos", "POST", { text: "A ning ishi" }, a);
    await req("/api/todos", "POST", { text: "B ning ishi" }, b);
    const ag = await (await req("/api/agents", "POST", { template: "marketing" }, a)).json();
    expect(ag.agent?.id ?? ag.id).toBeTruthy();
    const res = await req("/api/account/export", "GET", undefined, a);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const txt = await res.text();
    const j = JSON.parse(txt);
    expect(j.profile.email).toBe("a@example.com");
    expect(j.todos.map((t: any) => t.text)).toEqual(["A ning ishi"]);
    expect(j.agents).toHaveLength(1);
    expect(j.consents.length).toBeGreaterThanOrEqual(3);
    expect(txt).not.toContain("b@example.com");
    expect(txt).not.toContain("B ning ishi");
    expect(txt).not.toMatch(/password|scrypt|enc"/i);
    expect((db.prepare("SELECT action FROM audit_log WHERE action='account_export'").all() as unknown[]).length).toBe(1);
  });
});

describe("zaxira nusxa va health", () => {
  it("health sxema versiyasini ko'rsatadi", async () => {
    const j = await (await req("/api/health")).json();
    expect(j).toMatchObject({ ok: true });
    expect(j.schema).toBeGreaterThanOrEqual(8);
  });

  it("VACUUM INTO nusxa oladi, ochiladi va faqat oxirgi 7 tasi qoladi", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "doda-bk-")), "backups");
    db.prepare("INSERT INTO users (id,email,locale,created_at) VALUES ('u1','x@example.com','uz',1)").run();
    let last = "";
    for (let i = 0; i < 9; i++) last = backupDb(db, dir, Date.UTC(2026, 10, 10 + i, 3, 0, 0));
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(7);
    expect(files[0]).toBe("doda-20261112-030000.db");
    expect(existsSync(last)).toBe(true);
    const copy = openDb(last);
    expect((copy.prepare("SELECT email FROM users").get() as { email: string }).email).toBe("x@example.com");
    copy.close();
  });
});
