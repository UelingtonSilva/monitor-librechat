import type { FastifyInstance } from "fastify";
import type { McpAuditEntry, McpAuditStats } from "@monitor-librechat/shared";
import { Logging } from "@google-cloud/logging";
import { env } from "../env.js";
import { syntheticMcpAudit } from "../synthetic.js";

async function loadMcpAudit(): Promise<McpAuditStats> {
  // Both the project and at least one service name are required: without a service name
  // filter, this would need to read every log entry the GCP project has, for any service —
  // far too broad to default to silently.
  if (!env.gcpProject || env.mcpAuditServiceNames.length === 0) return syntheticMcpAudit();

  const logging = new Logging({ projectId: env.gcpProject });
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const serviceFilter = env.mcpAuditServiceNames
    .map((name) => `resource.labels.service_name="${name}"`)
    .join(" OR ");
  const filter = [`(${serviceFilter})`, `timestamp>="${periodStart.toISOString()}"`].join(" AND ");

  const [entries] = await logging.getEntries({ filter, pageSize: 200, orderBy: "timestamp desc" });

  const parsed: McpAuditEntry[] = entries.map((entry) => {
    const payload = (entry.data ?? {}) as Record<string, unknown>;
    return {
      timestamp: entry.metadata.timestamp?.toString() ?? periodEnd.toISOString(),
      service:
        (entry.metadata.resource?.labels?.service_name as string | undefined) ??
        env.mcpAuditServiceNames[0] ??
        "unknown",
      subjectRef: String(payload.subject_ref ?? payload.user ?? "unknown"),
      action: String(payload.action ?? payload.tool ?? "unknown"),
      resource: (payload.resource as string) ?? null,
    };
  });

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    entries: parsed,
  };
}

export async function mcpAuditRoutes(app: FastifyInstance) {
  app.get("/analytics/mcp-audit", async (_req, reply) => {
    try {
      reply.send(await loadMcpAudit());
    } catch (err) {
      app.log.error(err, "failed to query the log backend, returning synthetic data");
      reply.send(syntheticMcpAudit());
    }
  });
}
