import type { Db } from "mongodb";
import type { FastifyInstance } from "fastify";
import type {
  AdoptionTrend,
  CostTrend,
  ResourcesCatalog,
  OperationalStatus,
  TrendPoint,
} from "@monitor-librechat/shared";
import { getMongoDb, isMongoConfigured, getLastMongoError } from "../mongo.js";
import { loadAllowlists, mcpAllowedForRole, loadCorporateMcps } from "../resources.js";
import { getAuditEntries } from "../audit-log.js";
import { parsePeriod } from "./insights.js";
import { CONSUMPTION_ONLY } from "../token-types.js";
import { syntheticAdoptionTrend, syntheticCostTrend } from "../synthetic.js";
import { getSchemaChecks, collectionExists } from "../schema-guard.js";
import { estimateCost } from "../pricing.js";
import { env } from "../env.js";

const startedAt = Date.now();

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Builds an empty day series covering [start, end] so a day with no data renders as zero
// instead of disappearing from the chart, which would distort how the trend reads.
function emptySeriesRange(start: Date, end: Date): Map<string, number> {
  const map = new Map<string, number>();
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const limit = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  // Capped at 400 days so a mistyped period cannot generate an enormous series.
  for (let n = 0; d.getTime() <= limit && n < 400; n++) {
    map.set(d.toISOString().slice(0, 10), 0);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return map;
}

async function loadAdoptionTrend(from?: Date, to?: Date): Promise<AdoptionTrend> {
  const db = await getMongoDb();
  if (!db) return syntheticAdoptionTrend();

  const periodEnd = to ?? new Date();
  const periodStart = from ?? daysAgo(30);
  const rows = await db
    .collection("transactions")
    .aggregate([
      // Without CONSUMPTION_ONLY, anyone who merely received the daily top-up counted as an
      // active user that day, inflating the adoption series behind the users tile.
      { $match: { ...CONSUMPTION_ONLY, createdAt: { $gte: periodStart, $lte: periodEnd } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            user: "$user",
          },
        },
      },
      { $group: { _id: "$_id.day", users: { $sum: 1 } } },
    ])
    .toArray();

  const map = emptySeriesRange(periodStart, periodEnd);
  for (const row of rows) map.set(String(row._id), row.users as number);

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    dauSeries: [...map].map(([date, value]) => ({ date, value })) satisfies TrendPoint[],
  };
}

async function loadCostTrendFromAggregateCollection(
  db: Db,
  periodStart: Date,
  periodEnd: Date,
  collectionName: string
): Promise<CostTrend> {
  const rows = await db
    .collection(collectionName)
    .aggregate<{ _id: string; cost: number }>([
      {
        $match: {
          data: {
            $gte: periodStart.toISOString().slice(0, 10),
            $lte: periodEnd.toISOString().slice(0, 10),
          },
        },
      },
      { $group: { _id: "$data", cost: { $sum: "$custo_usd" } } },
    ])
    .toArray();

  const map = emptySeriesRange(periodStart, periodEnd);
  for (const row of rows) {
    map.set(String(row._id), Number(row.cost.toFixed(4)));
  }

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    costSeries: [...map].map(([date, value]) => ({ date, value })) satisfies TrendPoint[],
  };
}

async function loadCostTrendEstimate(
  db: Db,
  periodStart: Date,
  periodEnd: Date
): Promise<CostTrend> {
  const rows = await db
    .collection("transactions")
    .aggregate<{ _id: { day: string; model: string }; tokens: number }>([
      { $match: { createdAt: { $gte: periodStart, $lte: periodEnd }, ...CONSUMPTION_ONLY } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            model: "$model",
          },
          tokens: { $sum: { $abs: "$rawAmount" } },
        },
      },
    ])
    .toArray();

  const map = emptySeriesRange(periodStart, periodEnd);
  for (const row of rows) {
    const day = row._id.day;
    if (!map.has(day)) continue;
    const cost = estimateCost(String(row._id.model ?? "unknown"), row.tokens ?? 0);
    map.set(day, map.get(day)! + cost);
  }
  for (const [day, value] of map) map.set(day, Number(value.toFixed(4)));

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    costSeries: [...map].map(([date, value]) => ({ date, value })) satisfies TrendPoint[],
  };
}

async function loadCostTrend(from?: Date, to?: Date): Promise<CostTrend> {
  const db = await getMongoDb();
  if (!db) return syntheticCostTrend();

  const periodEnd = to ?? new Date();
  const periodStart = from ?? daysAgo(30);

  if (env.costCollectionName && (await collectionExists(db, env.costCollectionName))) {
    return loadCostTrendFromAggregateCollection(db, periodStart, periodEnd, env.costCollectionName);
  }
  return loadCostTrendEstimate(db, periodStart, periodEnd);
}

async function loadResources(): Promise<ResourcesCatalog> {
  const db = await getMongoDb();
  if (!db) return { profiles: [], agents: [], mcps: loadCorporateMcps() };

  const [users, agentDocs, allowlists] = await Promise.all([
    db
      .collection("users")
      .find({}, { projection: { role: 1 } })
      .toArray(),
    db
      .collection("agents")
      .find({}, { projection: { id: 1, name: 1 } })
      .toArray(),
    loadAllowlists(db),
  ]);

  const usersByProfile = new Map<string, number>();
  for (const u of users) {
    const role = String(u.role ?? "USER");
    usersByProfile.set(role, (usersByProfile.get(role) ?? 0) + 1);
  }

  // Only roles that actually exist: those with at least one user or their own configuration.
  const profiles = [...new Set([...usersByProfile.keys(), ...allowlists.keys()])].sort();

  return {
    profiles: profiles.map((profile) => {
      const allow = allowlists.get(profile);
      return {
        profile,
        users: usersByProfile.get(profile) ?? 0,
        allowedModels: allow?.models ?? [],
        enforce: allow?.enforce ?? false,
        mcpAllowed: mcpAllowedForRole(profile),
      };
    }),
    agents: agentDocs.map((a) => ({
      agentId: String(a.id ?? a._id),
      name: String(a.name ?? a.id),
      uses: 0,
    })),
    mcps: loadCorporateMcps(),
  };
}

// Answers "what will and won't work for my deployment" — the onboarding report a fresh
// clone has no other way to get today short of reading every optional integration's code.
// Each of these is OFF by default and only turns on when a deployment specifically
// configures it; none of this is required for the core dashboards (adoption, usage,
// security, audit) to work.
async function loadFeatureStatus(db: Db | null): Promise<OperationalStatus["featureStatus"]> {
  const features: OperationalStatus["featureStatus"] = [];

  if (!env.costCollectionName) {
    features.push({
      feature: "cost-pipeline",
      enabled: false,
      note: "COST_COLLECTION_NAME is not set — Costs uses a token-times-price estimate.",
    });
  } else if (db && (await collectionExists(db, env.costCollectionName))) {
    features.push({
      feature: "cost-pipeline",
      enabled: true,
      note: `Reading verified cost from the "${env.costCollectionName}" collection.`,
    });
  } else {
    features.push({
      feature: "cost-pipeline",
      enabled: false,
      note: `COST_COLLECTION_NAME is set to "${env.costCollectionName}", but that collection wasn't found — falling back to the token-times-price estimate.`,
    });
  }

  if (env.gcpProject && env.mcpAuditServiceNames.length > 0) {
    features.push({
      feature: "mcp-audit",
      enabled: true,
      note: `Reading platform logs for: ${env.mcpAuditServiceNames.join(", ")}.`,
    });
  } else {
    features.push({
      feature: "mcp-audit",
      enabled: false,
      note: "GOOGLE_CLOUD_PROJECT and/or MCP_AUDIT_SERVICE_NAMES aren't set — the MCP section of Audit Trail uses synthetic data.",
    });
  }

  const mcps = loadCorporateMcps();
  if (mcps.length === 0) {
    features.push({
      feature: "mcp-integrations",
      enabled: false,
      note: "policies/mcp-integrations.yaml has no integrations configured.",
    });
  } else if (mcps.some((m) => m.mcpId === "example-mcp")) {
    features.push({
      feature: "mcp-integrations",
      enabled: true,
      note: "Still using the placeholder example in policies/mcp-integrations.yaml — replace it with your own integrations.",
    });
  } else {
    features.push({
      feature: "mcp-integrations",
      enabled: true,
      note: `${mcps.length} integration(s) configured.`,
    });
  }

  return features;
}

async function loadStatus(): Promise<OperationalStatus> {
  let mongoConnected = false;
  let db: Db | null = null;
  let schemaChecks: OperationalStatus["schemaChecks"] = [];
  if (isMongoConfigured()) {
    try {
      db = await getMongoDb();
      await db?.command({ ping: 1 });
      mongoConnected = db !== null;
      if (db) schemaChecks = await getSchemaChecks(db);
    } catch {
      mongoConnected = false;
    }
  }

  return {
    status: mongoConnected || !isMongoConfigured() ? "ok" : "degraded",
    mongoConnected,
    mongoError: mongoConnected ? null : getLastMongoError(),
    version: "0.1.0",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    schemaChecks,
    featureStatus: await loadFeatureStatus(mongoConnected ? db : null),
    sloTargets: [
      {
        name: "Monitor API availability",
        target: ">= 99.9%",
        note: "To be calibrated after the first month in production.",
      },
      {
        name: "Query latency p95",
        target: "<= 1500 ms",
        note: "Aggregate queries against the LibreChat database.",
      },
      {
        name: "Inline pre-check latency p95",
        target: "<= 150 ms",
        note: "Not applicable: this build is observational only and has no inline enforcement (ADR-001).",
      },
      {
        name: "correlation_id coverage",
        target: ">= 99.5%",
        note: "Not applicable: no event pipeline in this build (ADR-002).",
      },
    ],
  };
}

export async function governanceRoutes(app: FastifyInstance) {
  app.get("/analytics/adoption-trend", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadAdoptionTrend(from, to));
    } catch (err) {
      app.log.error(err, "adoption-trend failed, returning synthetic data");
      reply.send(syntheticAdoptionTrend());
    }
  });

  app.get("/analytics/cost-trend", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadCostTrend(from, to));
    } catch (err) {
      app.log.error(err, "cost-trend failed, returning synthetic data");
      reply.send(syntheticCostTrend());
    }
  });

  app.get("/resources", async () => loadResources());

  app.get("/audit", async () => ({
    note: "Records access to the Monitor API on this instance (in-memory buffer, lost on restart). Durable storage arrives together with RBAC in a later phase.",
    entries: getAuditEntries(),
  }));

  app.get("/status", async () => loadStatus());
}
