import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8787),
  HOST: z.string().default("127.0.0.1"),
  DB_PATH: z.string().default("./data/doda.db"),
  /** Frontend manzili: CORS va Origin tekshiruvi uchun */
  APP_ORIGIN: z.string().url().default("https://doda.tajriba24.uz"),
  /** Caddy/Nginx ortida bo'lsa "true": X-Forwarded-For ga ishonamiz */
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Rozilik matni (oferta) versiyasi. Matn o'zgarganda yangilanadi */
  LEGAL_VERSION: z.string().default("2026-11-draft"),
});

export type Config = z.infer<typeof schema> & { isProd: boolean; trustProxy: boolean };

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.parse(env);
  return { ...parsed, isProd: parsed.NODE_ENV === "production", trustProxy: parsed.TRUST_PROXY === "true" };
}
