import type { Context } from "hono";
import { createHash } from "node:crypto";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { t, type Locale, type MessageCode } from "./i18n.js";
import type { Mailer } from "./mailer.js";
import type { GoogleClient } from "./google.js";
import type { LlmProvider } from "./llm/types.js";
import type { RateLimiter } from "./rateLimit.js";

export interface Deps {
  config: Config;
  db: Db;
  mailer: Mailer;
  limiter?: RateLimiter;
  now?: () => number;
  google?: GoogleClient | null;
  llm?: LlmProvider | null;
}

export type ResolvedDeps = Required<Omit<Deps, "google" | "llm">> & { google: GoogleClient | null; llm: LlmProvider | null };

export interface AuthedUser {
  id: string;
  email: string;
  locale: Locale;
  emailVerified: boolean;
  memoryEnabled: boolean;
}

export type Env = {
  Variables: {
    deps: ResolvedDeps;
    locale: Locale;
    ip: string;
    user?: AuthedUser;
  };
};

export function clientIp(c: Context<Env>, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
  }
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress ?? "unknown";
}

export function fail(c: Context<Env>, status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503, code: MessageCode, extra: object = {}) {
  return c.json({ error: { code, message: t(code, c.get("locale")), ...extra } }, status);
}

export function userRef(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

