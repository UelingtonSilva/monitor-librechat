import type { Db } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { AdoptionStats, UsageStats, CostStats } from "@monitor-librechat/shared";
import { getMongoDb, isMongoConfigured } from "../mongo.js";
import { syntheticAdoption, syntheticUsage, syntheticCost } from "../synthetic.js";
import { estimateCost } from "../pricing.js";
import { parsePeriod } from "./insights.js";
import { CONSUMPTION_ONLY } from "../token-types.js";
import { env } from "../env.js";
import { collectionExists } from "../schema-guard.js";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function emptyByProfile<T extends object>(roles: string[], zero: T): Record<string, T> {
  return Object.fromEntries(roles.map((r) => [r, { ...zero }]));
}

// LibreChat collections this module reads, verified against a live instance:
//
//   transactions   user, model, tokenType, rawAmount (negative), tokenValue, rate,
//                  conversationId, createdAt.
//                  CAREFUL: tokenType has THREE values, not two — "prompt", "completion"
//                  and "credits" (context "autoRefill", the daily budget top-up). "credits"
//                  is not consumption; summing without filtering inflates every figure.
//                  Only the first two existed when this integration was written, so the
//                  schema changed underneath the Monitor with no warning. Treat that as the
//                  normal case, not the exception.
//   users          role — free-form string defined by the deployment, not a fixed set
//   conversations  user, agent_id (references agents.id as a string, NOT agents._id),
//                  createdAt
//   agents         id (public string), name
async function loadAdoption(from?: Date, to?: Date): Promise<AdoptionStats> {
  const db = await getMongoDb();
  if (!db) return syntheticAdoption();

  const periodEnd = to ?? new Date();
  const periodStart = from ?? daysAgo(30);

  const users = await db
    .collection("users")
    .find({}, { projection: { role: 1 } })
    .toArray();

  // DAU and WAU are fixed windows by definition (1 and 7 days), independent of the selected
  // period. `mau` is different: it feeds the "N active" tile and the activation rate, so
  // when a period is selected it counts active users in THAT range. Otherwise the tile would
  // report 30 days while the rest of the screen showed a different window.
  const [dauIds, wauIds, mauIds] = await Promise.all([
    db
      .collection("transactions")
      .distinct("user", { ...CONSUMPTION_ONLY, createdAt: { $gte: daysAgo(1) } }),
    db
      .collection("transactions")
      .distinct("user", { ...CONSUMPTION_ONLY, createdAt: { $gte: daysAgo(7) } }),
    db
      .collection("transactions")
      .distinct("user", { ...CONSUMPTION_ONLY, createdAt: { $gte: periodStart, $lte: periodEnd } }),
  ]);

  const mauSet = new Set(mauIds.map(String));
  const presentRoles = [...new Set(users.map((u) => String(u.role ?? "USER")))].sort();
  const byProfile = emptyByProfile(presentRoles, { enabled: 0, activeInPeriod: 0 });

  for (const u of users) {
    const role = String(u.role ?? "USER");
    byProfile[role].enabled += 1;
    if (mauSet.has(String(u._id))) byProfile[role].activeInPeriod += 1;
  }

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    enabledUsers: users.length,
    dau: dauIds.length,
    wau: wauIds.length,
    mau: mauIds.length,
    activationRate: users.length > 0 ? mauIds.length / users.length : 0,
    byProfile,
  };
}

async function loadUsage(from?: Date, to?: Date): Promise<UsageStats> {
  const db = await getMongoDb();
  if (!db) return syntheticUsage();

  const periodEnd = to ?? new Date();
  const periodStart = from ?? daysAgo(30);
  const match = { createdAt: { $gte: periodStart, $lte: periodEnd } };
  // A credit top-up has no model and is not consumption. Without excluding it, usage-by-model
  // gained an empty "unknown" row.
  const consumptionMatch = { ...match, ...CONSUMPTION_ONLY };

  // Counted in its own try block: if db.files fails (missing collection, no permission) the
  // rest of the usage payload must not fall back to synthetic because of it. Note that null
  // means "could not read", which is not the same as zero files.
  let filesGenerated: number | null;
  try {
    filesGenerated = await db.collection("files").countDocuments(match);
  } catch {
    filesGenerated = null;
  }

  const [byModelRaw, totalConversations, byAgentRaw, agentDocs] = await Promise.all([
    db
      .collection("transactions")
      .aggregate([
        { $match: consumptionMatch },
        {
          $group: {
            _id: "$model",
            prompts: { $sum: { $cond: [{ $eq: ["$tokenType", "prompt"] }, 1, 0] } },
            inputTokens: {
              $sum: { $cond: [{ $eq: ["$tokenType", "prompt"] }, { $abs: "$rawAmount" }, 0] },
            },
            outputTokens: {
              $sum: { $cond: [{ $eq: ["$tokenType", "completion"] }, { $abs: "$rawAmount" }, 0] },
            },
          },
        },
        { $sort: { inputTokens: -1 } },
      ])
      .toArray(),
    db.collection("conversations").countDocuments(match),
    db
      .collection("conversations")
      .aggregate([
        { $match: { ...match, agent_id: { $ne: null } } },
        { $group: { _id: "$agent_id", uses: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection("agents")
      .find({}, { projection: { id: 1, name: 1 } })
      .toArray(),
  ]);

  // conversations.agent_id references agents.id (a string). Besides real agents, the field
  // also carries endpoint and model identifiers such as "anthropic__some-model". Those are
  // not configured agents and must stay out of the count.
  const agentNames = new Map(agentDocs.map((a) => [String(a.id), String(a.name ?? a.id)]));
  const byAgent = byAgentRaw
    .filter((a) => agentNames.has(String(a._id)))
    .map((a) => ({
      agentId: String(a._id),
      name: agentNames.get(String(a._id))!,
      uses: a.uses as number,
    }))
    .sort((x, y) => y.uses - x.uses);

  const byModel = byModelRaw.map((m) => ({
    model: String(m._id ?? "unknown"),
    prompts: m.prompts as number,
    tokens: (m.inputTokens as number) + (m.outputTokens as number),
  }));

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalPrompts: byModel.reduce((sum, m) => sum + m.prompts, 0),
    totalConversations,
    inputTokens: byModelRaw.reduce((s, m) => s + (m.inputTokens as number), 0),
    outputTokens: byModelRaw.reduce((s, m) => s + (m.outputTokens as number), 0),
    filesGenerated,
    byModel,
    byAgent,
  };
}

// Cost has two possible sources, chosen at request time depending on what this deployment
// actually has — see loadCost below for the branch.
//
// 1. An optional aggregate collection (name set via env.costCollectionName) holding apportioned
//    cost in USD, broken down by user email, model, date and token type, with a
//    verified-price flag and organisational dimensions. That collection is produced OUTSIDE
//    this project by a separate job, so its coverage can be narrower than the requested
//    period. The response carries `coverage` precisely so the UI can say what the total
//    actually spans instead of implying it covers the whole window.
// 2. A token-times-price estimate computed from the same `transactions` data Usage already
//    reads, priced via pricing.ts. This is what makes the Costs screen show a real (if
//    approximate) number for any LibreChat deployment out of the box, without requiring a
//    deployment-specific cost pipeline.
async function loadCostFromAggregateCollection(
  db: Db,
  periodStart: Date,
  periodEnd: Date,
  collectionName: string
): Promise<CostStats> {
  // The collection stores its date as a YYYY-MM-DD string, so the range filter is
  // lexicographic rather than a date comparison.
  const startDateStr = periodStart.toISOString().slice(0, 10);
  const endDateStr = periodEnd.toISOString().slice(0, 10);
  const match = { data: { $gte: startDateStr, $lte: endDateStr } };
  const collection = db.collection(collectionName);

  const [byModelRaw, byAreaRaw, byEmailRaw, verifiedRaw, coverage] = await Promise.all([
    collection
      .aggregate([
        { $match: match },
        // NOTE: this collection uses non-English field names because it is produced by an
        // external cost-apportioning job, not by LibreChat. Do NOT "translate" these strings:
        // they are database field names, and renaming them silently returns zeros. A test in
        // mongo-fields.test.ts guards this exact regression.
        { $group: { _id: "$modelo", cost: { $sum: "$custo_usd" }, tokens: { $sum: "$tokens" } } },
        { $sort: { cost: -1 } },
      ])
      .toArray(),
    collection
      .aggregate([
        { $match: match },
        { $group: { _id: "$area", cost: { $sum: "$custo_usd" }, tokens: { $sum: "$tokens" } } },
        { $sort: { cost: -1 } },
      ])
      .toArray(),
    collection
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: "$usuario_email",
            cost: { $sum: "$custo_usd" },
            tokens: { $sum: "$tokens" },
          },
        },
      ])
      .toArray(),
    collection
      .aggregate<{ _id: unknown; cost: number }>([
        { $match: match },
        { $group: { _id: "$preco_verificado", cost: { $sum: "$custo_usd" } } },
      ])
      .toArray(),
    collection
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            min: { $min: "$data" },
            max: { $max: "$data" },
            records: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  // The cost collection identifies people by email; the role comes from users.role.
  const users = await db
    .collection("users")
    .find({}, { projection: { email: 1, role: 1 } })
    .toArray();
  const roleByEmail = new Map(users.map((u) => [String(u.email), String(u.role ?? "USER")]));
  const presentRoles = [...new Set(users.map((u) => String(u.role ?? "USER")))].sort();
  const byProfile = emptyByProfile(presentRoles, { estimatedCost: 0, tokens: 0 });

  for (const row of byEmailRaw) {
    const role = roleByEmail.get(String(row._id));
    if (!role || !byProfile[role]) continue;
    byProfile[role].estimatedCost = Number(
      (byProfile[role].estimatedCost + (row.cost as number)).toFixed(4)
    );
    byProfile[role].tokens += (row.tokens as number) ?? 0;
  }

  const verified = verifiedRaw.find((v) => v._id === true)?.cost ?? 0;
  const unverified = verifiedRaw.find((v) => v._id !== true)?.cost ?? 0;
  const cob = coverage[0];

  return {
    synthetic: false,
    source: "aggregate-collection",
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalEstimatedCost: Number((verified + unverified).toFixed(4)),
    currency: "USD",
    coverage: cob
      ? { startDate: String(cob.min), endDate: String(cob.max), records: cob.records as number }
      : undefined,
    verifiedPrice: {
      verified: Number(verified.toFixed(4)),
      unverified: Number(unverified.toFixed(4)),
    },
    byProfile,
    byModel: byModelRaw.map((m) => ({
      model: String(m._id ?? "unknown"),
      estimatedCost: Number((m.cost as number).toFixed(4)),
      tokens: (m.tokens as number) ?? 0,
    })),
    byArea: byAreaRaw.map((a) => ({
      area: String(a._id ?? "UNMAPPED"),
      estimatedCost: Number((a.cost as number).toFixed(4)),
      tokens: (a.tokens as number) ?? 0,
    })),
  };
}

async function loadCostEstimate(db: Db, periodStart: Date, periodEnd: Date): Promise<CostStats> {
  const [rows, users] = await Promise.all([
    db
      .collection("transactions")
      .aggregate([
        { $match: { createdAt: { $gte: periodStart, $lte: periodEnd }, ...CONSUMPTION_ONLY } },
        {
          $group: {
            _id: { user: "$user", model: "$model" },
            tokens: { $sum: { $abs: "$rawAmount" } },
          },
        },
      ])
      .toArray(),
    db
      .collection("users")
      .find({}, { projection: { role: 1 } })
      .toArray(),
  ]);

  const roleById = new Map(users.map((u) => [String(u._id), String(u.role ?? "USER")]));
  const presentRoles = [...new Set(users.map((u) => String(u.role ?? "USER")))].sort();
  const byProfile = emptyByProfile(presentRoles, { estimatedCost: 0, tokens: 0 });
  const byModelMap = new Map<string, { tokens: number; estimatedCost: number }>();
  let totalEstimatedCost = 0;

  for (const row of rows) {
    const model = String(row._id.model ?? "unknown");
    const tokens = (row.tokens as number) ?? 0;
    const cost = estimateCost(model, tokens);
    totalEstimatedCost += cost;

    const modelBucket = byModelMap.get(model) ?? { tokens: 0, estimatedCost: 0 };
    modelBucket.tokens += tokens;
    modelBucket.estimatedCost += cost;
    byModelMap.set(model, modelBucket);

    const role = roleById.get(String(row._id.user));
    if (role && byProfile[role]) {
      byProfile[role].tokens += tokens;
      byProfile[role].estimatedCost += cost;
    }
  }

  for (const p of Object.values(byProfile)) p.estimatedCost = Number(p.estimatedCost.toFixed(4));

  return {
    synthetic: false,
    source: "estimate",
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(4)),
    currency: "USD",
    byProfile,
    byModel: [...byModelMap.entries()]
      .map(([model, v]) => ({
        model,
        estimatedCost: Number(v.estimatedCost.toFixed(4)),
        tokens: v.tokens,
      }))
      .sort((a, b) => b.estimatedCost - a.estimatedCost),
    // Area/cost-center isn't part of LibreChat's own schema — it only exists when a
    // deployment-specific aggregate collection provides it.
    byArea: [],
  };
}

async function loadCost(from?: Date, to?: Date): Promise<CostStats> {
  const db = await getMongoDb();
  if (!db) return syntheticCost();

  const periodEnd = to ?? new Date();
  const periodStart = from ?? daysAgo(30);

  if (env.costCollectionName && (await collectionExists(db, env.costCollectionName))) {
    return loadCostFromAggregateCollection(db, periodStart, periodEnd, env.costCollectionName);
  }
  return loadCostEstimate(db, periodStart, periodEnd);
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/adoption", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadAdoption(from, to));
    } catch (err) {
      app.log.error(err, "failed to query adoption from MongoDB, returning synthetic data");
      reply.send(syntheticAdoption());
    }
  });

  app.get("/analytics/usage", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadUsage(from, to));
    } catch (err) {
      app.log.error(err, "failed to query usage from MongoDB, returning synthetic data");
      reply.send(syntheticUsage());
    }
  });

  app.get("/analytics/cost", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadCost(from, to));
    } catch (err) {
      app.log.error(err, "failed to query cost from MongoDB, returning synthetic data");
      reply.send(syntheticCost());
    }
  });
}

export {
  isMongoConfigured,
  estimateCost,
  loadCost,
  loadCostEstimate,
  loadCostFromAggregateCollection,
};
