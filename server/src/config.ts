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
  /** Shu serverning ommaviy manzili (Google redirect uchun) */
  PUBLIC_API_URL: z.string().url().default("https://doda-api.tajriba24.uz"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Yuboruvchi manzili, masalan: DODA <noreply@example.com> */
  MAIL_FROM: z.string().optional(),
});

export type Config = z.infer<typeof schema> & { isProd: boolean; trustProxy: boolean };

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.parse(env);
  return { ...parsed, isProd: parsed.NODE_ENV === "production", trustProxy: parsed.TRUST_PROXY === "true" };
}
