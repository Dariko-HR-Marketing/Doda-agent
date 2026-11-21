import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { AnthropicProvider } from "./llm/anthropic.js";
import { GeminiProvider } from "./llm/gemini.js";
import { LlmRouter, type ProviderName, type Slot } from "./llm/multi.js";
import { OpenAIProvider } from "./llm/openai.js";
import type { LlmProvider } from "./llm/types.js";

export const PROVIDERS: ProviderName[] = ["anthropic", "gemini", "openai"];

export const KEY_FORMAT: Record<ProviderName, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,300}$/,
  openai: /^sk-[A-Za-z0-9_-]{20,300}$/,
  gemini: /^AIza[A-Za-z0-9_-]{30,60}$/,
};

/** Kalitni tozalaydi: bo'shliq/qo'shtirnoqlarni olib tashlaydi */
export function cleanKey(raw: string): string {
  return raw.replace(/[\s"'`]/g, "");
}

// ---------- shifrlash (AES-256-GCM). Kalit: KEYS_SECRET dan scrypt. AAD = foydalanuvchi+provayder (boshqa qatorga ko'chirib bo'lmaydi) ----------
const keyCache = new Map<string, Buffer>();
function masterKey(secret: string): Buffer {
  let k = keyCache.get(secret);
  if (!k) {
    k = scryptSync(secret, "doda-user-keys-v1", 32);
    keyCache.set(secret, k);
  }
  return k;
}

export function encryptKey(secret: string, userId: string, provider: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", masterKey(secret), iv);
  c.setAAD(Buffer.from(`${userId}:${provider}`));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return "v1." + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function decryptKey(secret: string, userId: string, provider: string, enc: string): string | null {
  try {
    if (!enc.startsWith("v1.")) return null;
    const raw = Buffer.from(enc.slice(3), "base64url");
    const d = createDecipheriv("aes-256-gcm", masterKey(secret), raw.subarray(0, 12));
    d.setAAD(Buffer.from(`${userId}:${provider}`));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---------- saqlash ----------
export interface KeyInfo { provider: ProviderName; last4: string; status: "active" | "invalid"; updatedAt: number }

export function saveKey(db: Db, secret: string, userId: string, provider: ProviderName, key: string, now: number): void {
  db.prepare(
    `INSERT INTO user_api_keys (user_id, provider, enc, last4, status, created_at, updated_at) VALUES (?,?,?,?, 'active', ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET enc = excluded.enc, last4 = excluded.last4, status = 'active', updated_at = excluded.updated_at`,
  ).run(userId, provider, encryptKey(secret, userId, provider, key), key.slice(-4), now, now);
}

export function deleteKey(db: Db, userId: string, provider: ProviderName): boolean {
  return db.prepare("DELETE FROM user_api_keys WHERE user_id = ? AND provider = ?").run(userId, provider).changes > 0;
}

export function listKeys(db: Db, userId: string): KeyInfo[] {
  const rows = db.prepare("SELECT provider, last4, status, updated_at FROM user_api_keys WHERE user_id = ?").all(userId) as Array<{ provider: ProviderName; last4: string; status: "active" | "invalid"; updated_at: number }>;
  return rows.map((r) => ({ provider: r.provider, last4: r.last4, status: r.status, updatedAt: r.updated_at }));
}

export function setKeyStatus(db: Db, userId: string, provider: ProviderName, status: "active" | "invalid"): void {
  db.prepare("UPDATE user_api_keys SET status = ? WHERE user_id = ? AND provider = ?").run(status, userId, provider);
}

// ---------- provayderlar ----------
export type ProviderFactory = (provider: ProviderName, key: string) => LlmProvider;

export function defaultFactory(config: Config): ProviderFactory {
  return (provider, key) => {
    if (provider === "anthropic") return new AnthropicProvider(key);
    if (provider === "openai") return new OpenAIProvider(key, fetch, 90_000, config.OPENAI_BASE_URL);
    return new GeminiProvider(key, fetch, 90_000, config.GEMINI_BASE_URL);
  };
}

export function modelsFor(config: Config, p: ProviderName): Slot["models"] {
  if (p === "anthropic") return { light: config.ANTHROPIC_MODEL_LIGHT, main: config.ANTHROPIC_MODEL_MAIN };
  if (p === "openai") return { light: config.OPENAI_MODEL_LIGHT, main: config.OPENAI_MODEL_MAIN, stt: config.OPENAI_MODEL_STT };
  return { light: config.GEMINI_MODEL_LIGHT, main: config.GEMINI_MODEL_MAIN, stt: config.GEMINI_MODEL_STT };
}

/** Kalitni arzon so'rov bilan tekshiradi. Tekshiruv narxi foydalanuvchining o'z hisobidan (bir necha token). */
export async function probeKey(config: Config, factory: ProviderFactory, provider: ProviderName, key: string): Promise<LlmProvider> {
  const llm = factory(provider, key);
  await llm.complete({ model: modelsFor(config, provider).light, system: "Reply with the single word: ok", messages: [{ role: "user", content: "ok" }], signal: AbortSignal.timeout(25_000) });
  return llm;
}

// ---------- foydalanuvchi marshrutizatori ----------
interface Cached { router: LlmRouter; expires: number }

/** Har bir foydalanuvchi uchun faqat uning o'z kalitlaridan marshrutizator quradi (10 daqiqa keshlanadi). */
export class UserLlm {
  private cache = new Map<string, Cached>();

  constructor(
    private db: Db,
    private config: Config,
    private factory: ProviderFactory,
    private now: () => number,
  ) {}

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  get(userId: string): LlmRouter | null {
    const secret = this.config.KEYS_SECRET;
    if (!secret) return null;
    const hit = this.cache.get(userId);
    if (hit && hit.expires > this.now()) return hit.router;
    const rows = this.db.prepare("SELECT provider, enc FROM user_api_keys WHERE user_id = ? AND status = 'active'").all(userId) as Array<{ provider: ProviderName; enc: string }>;
    const byName = new Map<string, Slot>();
    for (const r of rows) {
      const key = decryptKey(secret, userId, r.provider, r.enc);
      if (!key) continue;
      byName.set(r.provider, { name: r.provider, provider: this.factory(r.provider, key), models: modelsFor(this.config, r.provider) });
    }
    const order = [...new Set([...this.config.LLM_PRIORITY.split(",").map((x) => x.trim()), ...PROVIDERS])];
    const slots = order.map((n) => byName.get(n)).filter((x): x is Slot => !!x);
    if (!slots.length) return null;
    const router = new LlmRouter(slots, this.now, (name, status) => {
      // Provayder kalitni rad etdi (401/403): interfeysda "yaroqsiz" deb ko'rsatamiz; keyingi so'rovlarda o'tkazib yuboriladi
      if (status === 401 || status === 403) {
        setKeyStatus(this.db, userId, name, "invalid");
        this.cache.delete(userId);
      }
    });
    this.cache.set(userId, { router, expires: this.now() + 10 * 60_000 });
    return router;
  }
}
