import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { HttpGoogleClient } from "./google.js";
import { AnthropicProvider } from "./llm/anthropic.js";
import { GeminiProvider } from "./llm/gemini.js";
import { LlmRouter, type Slot } from "./llm/multi.js";
import { OpenAIProvider } from "./llm/openai.js";
import { createMailer } from "./mailer.js";

const config = loadConfig();
const db = openDb(config.DB_PATH);
const google =
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
    ? new HttpGoogleClient(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        `${config.PUBLIC_API_URL}/api/auth/google/callback`,
      )
    : null;
const slotsByName: Record<string, Slot | null> = {
  gemini: config.GEMINI_API_KEY
    ? { name: "gemini", provider: new GeminiProvider(config.GEMINI_API_KEY, fetch, 90_000, config.GEMINI_BASE_URL), models: { light: config.GEMINI_MODEL_LIGHT, main: config.GEMINI_MODEL_MAIN, stt: config.GEMINI_MODEL_STT } }
    : null,
  anthropic: config.ANTHROPIC_API_KEY
    ? { name: "anthropic", provider: new AnthropicProvider(config.ANTHROPIC_API_KEY), models: { light: config.ANTHROPIC_MODEL_LIGHT, main: config.ANTHROPIC_MODEL_MAIN } }
    : null,
  openai: config.OPENAI_API_KEY
    ? { name: "openai", provider: new OpenAIProvider(config.OPENAI_API_KEY, fetch, 90_000, config.OPENAI_BASE_URL), models: { light: config.OPENAI_MODEL_LIGHT, main: config.OPENAI_MODEL_MAIN, stt: config.OPENAI_MODEL_STT } }
    : null,
};
const order = config.LLM_PRIORITY.split(",").map((x) => x.trim()).filter(Boolean);
const slots = [...new Set([...order, "gemini", "anthropic", "openai"])].map((n) => slotsByName[n]).filter((x): x is Slot => !!x);
const llm = slots.length ? new LlmRouter(slots) : null;
if (!llm) console.warn("[llm] hech bir AI kaliti yo'q (GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY): suhbat o'chiq");
else console.log(`[llm] yoqilgan provayderlar (ustuvorlik bo'yicha): ${slots.map((x) => x.name).join(" > ")}`);
const app = createApp({ config, db, mailer: createMailer(config), google, llm });

// Muddati o'tgan sessiya va tokenlarni tozalash
function cleanup(): void {
  const t = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(t);
  db.prepare("DELETE FROM email_tokens WHERE expires_at < ?").run(t);
  db.prepare("DELETE FROM oauth_states WHERE expires_at < ?").run(t);
}
cleanup();
const timer = setInterval(cleanup, 60 * 60 * 1000);
timer.unref();

const server = serve({ fetch: app.fetch, port: config.PORT, hostname: config.HOST }, (info) => {
  console.log(`DODA server http://${info.address}:${info.port} (${config.NODE_ENV})`);
});

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
