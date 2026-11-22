import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { pickLocale } from "./i18n.js";
import { clientIp, fail, type Deps, type Env, type ResolvedDeps } from "./http.js";
import { RateLimiter } from "./rateLimit.js";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { googleRoutes } from "./routes/google.js";
import { chatRoutes } from "./routes/chat.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { taskRoutes } from "./routes/tasks.js";
import { agentRoutes } from "./routes/agents.js";
import { voiceRoutes } from "./routes/voice.js";
import { keyRoutes } from "./routes/keys.js";
import { dodaRoutes, todoRoutes } from "./routes/todos.js";
import { todayRoutes } from "./routes/today.js";
import { UserLlm, defaultFactory } from "./userkeys.js";

export function createApp(input: Deps): Hono<Env> {
  const now = input.now ?? Date.now;
  const factory = input.providerFactory ?? defaultFactory(input.config);
  const userLlm = new UserLlm(input.db, input.config, factory, now);
  const shared = input.llm ?? null;
  const deps: ResolvedDeps = {
    ...input,
    limiter: input.limiter ?? new RateLimiter(input.now),
    now,
    google: input.google ?? null,
    llm: shared,
    userLlm,
    factory,
    llmFor(userId) {
      const own = userLlm.get(userId);
      if (own) return { llm: own, own: true };
      return shared ? { llm: shared, own: false } : null;
    },
  };
  const { config } = deps;
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    c.set("deps", deps);
    c.set("locale", pickLocale(c.req.header("accept-language")));
    c.set("ip", clientIp(c, config.trustProxy));
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cache-Control", "no-store");
    c.header("X-Frame-Options", "DENY");
    if (config.isProd) c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  });

  // So'rov hajmi: odatda 16 KB; ishchi maydon fayllari uchun kattaroq (fayl ko'pi bilan 64 KB + JSON/Unicode qoldig'i)
  const small = bodyLimit({ maxSize: 16 * 1024, onError: (c) => fail(c as never, 400, "invalid_input") });
  const audio = bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => fail(c as never, 400, "audio_invalid") });
  const large = bodyLimit({ maxSize: 300 * 1024, onError: (c) => fail(c as never, 400, "invalid_input") });
  // /api/chat: xabar 20 000 belgigacha (kirill UTF-8 da 2 baytdan) + biriktirilgan matnli fayllar
  const chatLimit = bodyLimit({ maxSize: 100 * 1024, onError: (c) => fail(c as never, 400, "invalid_input") });
  app.use("/api/*", (c, next) => {
    const path = c.req.path;
    return (path.startsWith("/api/workspace/") ? large : path === "/api/voice/transcribe" ? audio : path === "/api/chat" ? chatLimit : small)(c, next);
  });

  // CORS: faqat bizning frontend manzilimiz
  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("origin");
    if (origin && origin !== config.APP_ORIGIN) {
      return fail(c, 403, "forbidden_origin");
    }
    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Vary", "Origin");
    }
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type,Accept-Language");
      c.header("Access-Control-Max-Age", "600");
      return c.body(null, 204);
    }
    // CSRF: o'zgartiruvchi so'rovlar faqat JSON bo'lishi kerak (oddiy HTML forma yubora olmaydi)
    if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
      const ct = c.req.header("content-type") ?? "";
      const hasBody = (c.req.header("content-length") ?? "0") !== "0";
      if (hasBody && !ct.toLowerCase().startsWith("application/json")) {
        return fail(c, 400, "invalid_input");
      }
    }
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true, version: "0.1.0" }));
  app.route("/api/auth", authRoutes);
  app.route("/api/auth/google", googleRoutes);
  app.route("/api/account", accountRoutes);
  app.route("/api/workspace", workspaceRoutes);
  app.route("/api/tasks", taskRoutes);
  app.route("/api/agents", agentRoutes);
  app.route("/api/voice", voiceRoutes);
  app.route("/api/keys", keyRoutes);
  app.route("/api/todos", todoRoutes);
  app.route("/api/doda", dodaRoutes);
  app.route("/api/today", todayRoutes);
  app.route("/api", chatRoutes);

  app.notFound((c) => fail(c, 404, "not_found"));
  app.onError((err, c) => {
    console.error("[error]", err);
    return fail(c, 500, "server_error");
  });

  return app;
}
