import path from "node:path";
import { randomBytes } from "node:crypto";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI || null,
  mongoDb: process.env.MONGO_DB || "LibreChat",
  gcpProject: process.env.GOOGLE_CLOUD_PROJECT || null,
  // Name of an optional, deployment-specific collection that apportions token usage into a
  // verified USD cost (see loadCost in analytics.ts). This project doesn't produce or require
  // one — without it, cost is estimated from token counts times a placeholder price table
  // instead. Only set this if your deployment already has such a pipeline.
  costCollectionName: process.env.COST_COLLECTION_NAME || null,
  // Comma-separated Cloud Logging `resource.labels.service_name` values to read for the MCP
  // audit trail (e.g. names of your own MCP proxy services). Empty means the feature is off
  // and that endpoint returns synthetic data, same as no GOOGLE_CLOUD_PROJECT at all.
  mcpAuditServiceNames: (process.env.MCP_AUDIT_SERVICE_NAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // In development (npm workspaces) the cwd is apps/monitor-api, so ../../policies resolves
  // to the repository root. In the container, POLICIES_DIR is set explicitly.
  policiesDir: process.env.POLICIES_DIR || path.resolve(process.cwd(), "../../policies"),
  // When set, the API also serves the built portal from the same origin. That keeps the
  // browser calling /api/v1/* without CORS and puts everything behind one authentication
  // boundary.
  portalDir: process.env.PORTAL_DIR || null,

  adminUser: process.env.ADMIN_USER || "admin",
  // scrypt hash. Without it login never succeeds, which is the safe default: shipping a
  // built-in password would be an open door.
  adminHash: process.env.ADMIN_PASSWORD_HASH || null,
  // Session signing secret. If absent, an ephemeral one is generated: sessions then die on
  // every restart, which is inconvenient but never insecure.
  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
  // The Secure cookie flag requires HTTPS. Only turn it off for local development.
  cookieSecure: process.env.COOKIE_SECURE !== "false",
};
