import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { HttpGoogleClient } from "./google.js";
import { GeminiProvider } from "./llm/gemini.js";
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
const llm = config.GEMINI_API_KEY ? new GeminiProvider(config.GEMINI_API_KEY, fetch, 90_000, config.GEMINI_BASE_URL) : null;
if (!llm) console.warn("[llm] GEMINI_API_KEY yo'q: suhbat o'chiq");
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
