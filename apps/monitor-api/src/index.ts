// Must run before `./env.js` is imported below: that module reads process.env at import
// time. Loading a .env file is a local-dev convenience only — Docker/Cloud Run set real
// env vars directly, and dotenv never overwrites a variable that's already set, so this is
// a no-op there (and a no-op with no .env file present, which the production image never
// has — only the compiled dist/ output is copied into it, never the source .env).
import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import cookie from "@fastify/cookie";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { mcpAuditRoutes } from "./routes/mcp-audit.js";
import { securityRoutes } from "./routes/security.js";
import { governanceRoutes } from "./routes/governance.js";
import { insightsRoutes } from "./routes/insights.js";
import { recordAudit } from "./audit-log.js";
import { authRoutes, registerGuard } from "./auth.js";

async function main() {
  const app = Fastify({ logger: true });

  app.addHook("onResponse", async (req, reply) => {
    if (req.url === "/health" || req.url === "/ready") return;
    recordAudit({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
      correlationId: (req.headers["x-correlation-id"] as string) ?? randomUUID(),
    });
  });

  await app.register(cookie);
  // The portal is served by this same API, so there is no legitimate cross-origin caller.
  // Reflecting the request origin with credentials enabled would expose the session cookie.
  await app.register(cors, { origin: false });
  registerGuard(app);
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(healthRoutes);
  await app.register(analyticsRoutes, { prefix: "/api/v1" });
  await app.register(mcpAuditRoutes, { prefix: "/api/v1" });
  await app.register(securityRoutes, { prefix: "/api/v1" });
  await app.register(governanceRoutes, { prefix: "/api/v1" });
  await app.register(insightsRoutes, { prefix: "/api/v1" });

  if (env.portalDir && fs.existsSync(env.portalDir)) {
    await app.register(fastifyStatic, { root: env.portalDir });
    // SPA fallback: any non-API route returns index.html and lets the router resolve it.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        reply.code(404).send({ error: "not found" });
        return;
      }
      reply.sendFile("index.html");
    });
    app.log.info({ portalDir: env.portalDir }, "serving portal static assets from the same origin");
  }

  await app.listen({ port: env.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
