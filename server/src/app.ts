import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { pickLocale } from "./i18n.js";
import { clientIp, fail, type Deps, type Env, type ResolvedDeps } from "./http.js";
import { RateLimiter } from "./rateLimit.js";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { googleRoutes } from "./routes/google.js";
import { chatRoutes } from "./routes/chat.js";

export function createApp(input: Deps): Hono<Env> {
  const deps: ResolvedDeps = {
    ...input,
    limiter: input.limiter ?? new RateLimiter(input.now),
    now: input.now ?? Date.now,
    google: input.google ?? null,
    llm: input.llm ?? null,
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

  app.use("/api/*", bodyLimit({ maxSize: 16 * 1024, onError: (c) => fail(c as never, 400, "invalid_input") }));

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
      c.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
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
  app.route("/api", chatRoutes);

  app.notFound((c) => fail(c, 404, "not_found"));
  app.onError((err, c) => {
    console.error("[error]", err);
    return fail(c, 500, "server_error");
  });

  return app;
}
