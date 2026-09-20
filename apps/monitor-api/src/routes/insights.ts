import type { FastifyInstance } from "fastify";
import type {
  ProfileUsageStats,
  ConductStats,
  ConductCause,
  TokenBucket,
  ConductState,
  UserActivityStats,
} from "@monitor-librechat/shared";
import { getMongoDb } from "../mongo.js";
import { loadSecurity } from "./security.js";
import { CONSUMPTION_ONLY } from "../token-types.js";
import { syntheticProfileUsage, syntheticConduct, syntheticUserActivity } from "../synthetic.js";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Per-role averages normalised by ACTIVE user, not by enabled user. Roles differ wildly in
// headcount, so comparing totals would mostly measure team size rather than how each role
// actually uses the tool.
async function loadProfileUsage(from?: Date, to?: Date): Promise<ProfileUsageStats> {
  const db = await getMongoDb();
  if (!db) return syntheticProfileUsage();

  const periodEnd = to ?? new Date();
  const periodStart = from ?? daysAgo(30);
  const since = { $gte: periodStart, $lte: periodEnd };

  const [users, txs, convs] = await Promise.all([
    db
      .collection("users")
      .find({}, { projection: { role: 1 } })
      .toArray(),
    db
      .collection("transactions")
      // tokenType "credits" (the daily budget top-up) is not consumption. Including it
      // inflated the per-role radar by up to 228% in production.
      .find(
        { createdAt: since, ...CONSUMPTION_ONLY },
        { projection: { user: 1, model: 1, tokenType: 1, rawAmount: 1, createdAt: 1 } }
      )
      .toArray(),
    db
      .collection("conversations")
      .find({ createdAt: since }, { projection: { user: 1, agent_id: 1 } })
      .toArray(),
  ]);

  const roleOf = new Map(users.map((u) => [String(u._id), String(u.role ?? "USER")]));

  interface Acc {
    active: Set<string>;
    tokens: number;
    prompts: number;
    conversations: number;
    models: Set<string>;
    agents: Set<string>;
    daysByUser: Map<string, Set<string>>;
  }
  const byRole = new Map<string, Acc>();
  const usersByRole = new Map<string, number>();
  for (const u of users) {
    const r = String(u.role ?? "USER");
    usersByRole.set(r, (usersByRole.get(r) ?? 0) + 1);
  }
  const acc = (r: string): Acc => {
    let a = byRole.get(r);
    if (!a) {
      a = {
        active: new Set(),
        tokens: 0,
        prompts: 0,
        conversations: 0,
        models: new Set(),
        agents: new Set(),
        daysByUser: new Map(),
      };
      byRole.set(r, a);
    }
    return a;
  };

  for (const t of txs) {
    const uid = String(t.user);
    const r = roleOf.get(uid);
    if (!r) continue;
    const a = acc(r);
    a.active.add(uid);
    a.tokens += Math.abs((t.rawAmount as number) ?? 0);
    if (t.tokenType === "prompt") a.prompts += 1;
    if (t.model) a.models.add(String(t.model));
    if (t.createdAt instanceof Date) {
      const dia = t.createdAt.toISOString().slice(0, 10);
      if (!a.daysByUser.has(uid)) a.daysByUser.set(uid, new Set());
      a.daysByUser.get(uid)!.add(dia);
    }
  }
  for (const c of convs) {
    const uid = String(c.user);
    const r = roleOf.get(uid);
    if (!r) continue;
    const a = acc(r);
    a.conversations += 1;
    if (c.agent_id && String(c.agent_id).startsWith("agent_")) a.agents.add(String(c.agent_id));
  }

  const profiles = [...new Set([...usersByRole.keys(), ...byRole.keys()])].sort().map((r) => {
    const a = byRole.get(r);
    const active = a?.active.size ?? 0;
    const div = active || 1;
    const diasTotal = a ? [...a.daysByUser.values()].reduce((s, set) => s + set.size, 0) : 0;
    return {
      profile: r,
      users: usersByRole.get(r) ?? 0,
      active,
      totalTokens: a?.tokens ?? 0,
      tokensPerActive: Math.round((a?.tokens ?? 0) / div),
      promptsPerActive: Number(((a?.prompts ?? 0) / div).toFixed(1)),
      conversationsPerActive: Number(((a?.conversations ?? 0) / div).toFixed(1)),
      avgActiveDays: Number((diasTotal / div).toFixed(2)),
      distinctModels: a?.models.size ?? 0,
      distinctAgents: a?.agents.size ?? 0,
    };
  });

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    profiles,
  };
}

// ALL registered users, not only those active in the period. Sorted by lastAccess
// descending; users with neither a sign-in nor recorded usage go last. See `lastAccessOf`
// for how that date is derived, since LibreChat has no explicit last-login field.
//
// Display names are shown rather than pseudonymised ids: this screen is administrative and
// its whole purpose is per-user accountability. The audit, alert and MCP payloads stay
// pseudonymised, because those expose behaviour rather than a roster.
//
// `active` = had CONSUMPTION in the period, matching the `mau` shown on the users tile so
// the two agree. An earlier version used "session OR transaction", which in practice marked
// every user active, since everyone had signed in at some point in the window. That left
// the column with no discriminating power and contradicted the tile that opens this modal.
// Someone who signed in without consuming shows as inactive but keeps a last-access date,
// which is the useful signal in that case: came in, did not use it.
async function loadUserActivity(from?: Date, to?: Date): Promise<UserActivityStats> {
  const db = await getMongoDb();
  if (!db) return syntheticUserActivity();

  const periodEnd = to ?? new Date();
  const periodStart = from ?? daysAgo(30);

  const [userDocs, usage, sessions, lastUsageRaw] = await Promise.all([
    db
      .collection("users")
      .find({}, { projection: { role: 1, name: 1, username: 1, email: 1 } })
      .toArray(),
    db
      .collection("transactions")
      .aggregate([
        {
          $match: {
            createdAt: { $gte: periodStart, $lte: periodEnd },
            // Real consumption only. db.transactions also stores tokenType "credits"
            // (context "autoRefill"), the daily budget top-up granted by LibreChat: credit
            // given, not tokens spent. Without this filter a top-up counted as usage, and
            // one user showed 573k tokens having actually consumed 173k.
            ...CONSUMPTION_ONLY,
          },
        },
        {
          $group: {
            _id: "$user",
            totalTokens: { $sum: { $abs: "$rawAmount" } },
            prompts: { $sum: { $cond: [{ $eq: ["$tokenType", "prompt"] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
    db
      .collection("sessions")
      .aggregate([{ $group: { _id: "$user", lastSession: { $max: "$_id" } } }])
      .toArray(),
    // Last transaction EVER, deliberately not restricted to the selected period. Last
    // access is a fact about the user, not about the window being queried; filtering here
    // would make the date vanish whenever the chosen period excluded their last activity.
    db
      .collection("transactions")
      .aggregate([
        // An automatic credit top-up is not a person accessing the system: that job runs
        // on its own schedule.
        { $match: { ...CONSUMPTION_ONLY } },
        { $group: { _id: "$user", lastUsage: { $max: "$createdAt" } } },
      ])
      .toArray(),
  ]);

  const roleOf = new Map(userDocs.map((u) => [String(u._id), String(u.role ?? "USER")]));
  const nameOf = new Map(
    userDocs.map((u) => [String(u._id), String(u.name ?? u.username ?? u.email ?? "(sem name)")])
  );
  const usageByUser = new Map(usage.map((u) => [String(u._id), u]));

  // Last access = the more recent of sign-in and actual usage.
  //
  // LibreChat sessions last seven days and are NOT recreated per visit. Verified against a
  // live database, where expiration minus _id.getTimestamp() was exactly 168h for every
  // session. So a user who is already signed in keeps working without a new session
  // document, and the ObjectId timestamp freezes at the initial sign-in. Using the session
  // alone reported a last access days older than transactions from the same day.
  const sessionTs = new Map(
    sessions.map((s) => [String(s._id), s.lastSession?.getTimestamp?.() ?? null])
  );
  const usageTs = new Map(
    lastUsageRaw.map((u) => [String(u._id), u.lastUsage instanceof Date ? u.lastUsage : null])
  );

  function lastAccessOf(uid: string): { date: Date | null; source: "login" | "usage" | null } {
    const login = sessionTs.get(uid) ?? null;
    const usageDate = usageTs.get(uid) ?? null;
    if (login && usageDate)
      return usageDate > login
        ? { date: usageDate, source: "usage" }
        : { date: login, source: "login" };
    if (usageDate) return { date: usageDate, source: "usage" };
    if (login) return { date: login, source: "login" };
    return { date: null, source: null };
  }

  const activeIdsInPeriod = new Set(usage.map((u) => String(u._id)));

  const users = userDocs
    .map((u) => String(u._id))
    .map((uid) => {
      const u = usageByUser.get(uid);
      const access = lastAccessOf(uid);
      return {
        name: nameOf.get(uid)!,
        profile: roleOf.get(uid)!,
        active: activeIdsInPeriod.has(uid),
        totalTokens: (u?.totalTokens as number) ?? 0,
        prompts: (u?.prompts as number) ?? 0,
        lastAccess: access.date ? access.date.toISOString() : null,
        lastAccessSource: access.source,
      };
    })
    .sort((a, b) => {
      if (a.lastAccess === null && b.lastAccess === null) return 0;
      if (a.lastAccess === null) return 1;
      if (b.lastAccess === null) return -1;
      return b.lastAccess.localeCompare(a.lastAccess);
    });

  return {
    synthetic: false,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    users,
  };
}

const BUCKET_HOURS = 1;
const WINDOW_BUCKETS = 48;
const ZSCORE_WINDOW = 20;

// Statistical conduct signal: distance from normal behaviour (moving mean plus or minus
// the standard deviation of previous buckets), not a count of violated rules. It catches
// deviation no deterministic rule would predict: a consumption spike outside business hours
// breaks no policy but is anomalous. A critical or high policy detection still forces
// "critical" regardless of the z-score, because statistics must never silence an exposed
// secret.
//
// The chart series follows the selected period. With no filter it shows the last 48 hours
// in one-hour buckets; with a period chosen it covers the whole range and the bucket widens
// so the chart does not turn into hundreds of bars.
function bucketHoursFor(days: number): number {
  if (days <= 3) return 1;
  if (days <= 14) return 6;
  return 24;
}

async function loadConduct(from?: Date, to?: Date): Promise<ConductStats> {
  const db = await getMongoDb();
  if (!db) return syntheticConduct();

  const end = to ?? new Date();
  const days = from ? Math.max(1, Math.ceil((end.getTime() - from.getTime()) / 86_400_000)) : 2;
  const bucketHours = from ? bucketHoursFor(days) : BUCKET_HOURS;
  const totalBuckets = from
    ? Math.min(400, Math.max(2, Math.ceil((days * 24) / bucketHours)))
    : WINDOW_BUCKETS;
  const since = from ?? new Date(end.getTime() - WINDOW_BUCKETS * BUCKET_HOURS * 3_600_000);

  const rows = await db
    .collection("transactions")
    .aggregate([
      // Each series already filtered by tokenType inside its $cond, but without this
      // $match a credit top-up still counted toward the document total of the bucket.
      // Filtering here keeps the cut identical to every other query.
      { $match: { ...CONSUMPTION_ONLY, createdAt: { $gte: since, $lte: end } } },
      {
        $group: {
          _id: { $dateTrunc: { date: "$createdAt", unit: "hour", binSize: bucketHours } },
          input: {
            $sum: { $cond: [{ $eq: ["$tokenType", "prompt"] }, { $abs: "$rawAmount" }, 0] },
          },
          output: {
            $sum: { $cond: [{ $eq: ["$tokenType", "completion"] }, { $abs: "$rawAmount" }, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const byTimestamp = new Map(rows.map((r) => [r._id.toISOString(), r]));
  const series: TokenBucket[] = [];
  for (let i = totalBuckets - 1; i >= 0; i--) {
    const start = new Date(end.getTime() - i * bucketHours * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    // $dateTrunc aligns buckets from the epoch, so the lookup key needs the same alignment.
    // Without it, 6h and 24h buckets would never match the aggregation output.
    const aligned = new Date(
      Math.floor(start.getTime() / (bucketHours * 3_600_000)) * (bucketHours * 3_600_000)
    );
    const row = byTimestamp.get(aligned.toISOString());
    series.push({
      timestamp: aligned.toISOString(),
      input: (row?.input as number) ?? 0,
      output: (row?.output as number) ?? 0,
    });
  }

  const totals = series.map((b) => b.input + b.output);
  const last = totals[totals.length - 1] ?? 0;
  const window = totals.slice(-1 - ZSCORE_WINDOW, -1);
  let zScore: number | null = null;
  let meanTokens = 0;
  let stdDevTokens = 0;
  if (window.length >= 5) {
    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const stdDev = Math.sqrt(variance);
    zScore = stdDev > 0 ? (last - mean) / stdDev : 0;
    meanTokens = mean;
    stdDevTokens = stdDev;
  }

  // Every signal that actually contributes to the semaphore is recorded as its own cause,
  // not just whichever one happens to decide `state`. Before this, a critical-severity
  // detection silently swallowed a simultaneous z-score anomaly (or vice-versa): the API
  // kept only one "reason" string, so the Portal's Conduct dialog could show "Critical"
  // with an empty detections list and no way to tell why. Both signals are independent and
  // both get their own entry here whenever they are not "normal".
  const causes: ConductCause[] = [];

  if (zScore !== null) {
    const az = Math.abs(zScore);
    if (az >= 2) {
      const severity: Exclude<ConductState, "normal"> = az >= 3 ? "critical" : "warning";
      causes.push({
        kind: "token-volume-anomaly",
        severity,
        summary: `Latest bucket is ${az.toFixed(1)} standard deviations outside the expected band.`,
        tokenAnomaly: {
          zScore: Number(zScore.toFixed(2)),
          bucketTokens: last,
          meanTokens: Math.round(meanTokens),
          stdDevTokens: Math.round(stdDevTokens),
          windowBuckets: window.length,
          bucketTimestamp: series[series.length - 1]?.timestamp ?? end.toISOString(),
        },
      });
    }
  }

  try {
    const security = await loadSecurity();
    if (security.bySeverity.critical > 0 || security.bySeverity.high > 0) {
      const severity: Exclude<ConductState, "normal"> =
        security.bySeverity.critical > 0 ? "critical" : "warning";
      const parts: string[] = [];
      if (security.bySeverity.critical > 0) parts.push(`${security.bySeverity.critical} critical`);
      if (security.bySeverity.high > 0) parts.push(`${security.bySeverity.high} high`);
      causes.push({
        kind: "security-detection",
        severity,
        summary: `${parts.join(" and ")} severity detection(s) open (see Security & Risk).`,
        securityDetection: {
          criticalCount: security.bySeverity.critical,
          highCount: security.bySeverity.high,
        },
      });
    }
  } catch {
    // Failing to read security must not take the signal down: it still reflects the z-score.
  }

  const state: ConductState = causes.some((c) => c.severity === "critical")
    ? "critical"
    : causes.some((c) => c.severity === "warning")
      ? "warning"
      : "normal";

  const reason =
    causes.length > 0
      ? causes.map((c) => c.summary).join(" ")
      : zScore === null
        ? "Not enough history (fewer than 5 buckets) to compute the band; still accumulating data."
        : "Consumption within the expected band (moving mean +/- 2 standard deviations).";

  return {
    synthetic: false,
    bucketMinutes: bucketHours * 60,
    zScore: zScore === null ? null : Number(zScore.toFixed(2)),
    state,
    reason,
    causes,
    series,
  };
}

/** Reads ?from= and ?to= (YYYY-MM-DD or ISO). An invalid date is ignored rather than
 *  returning 400: a malformed period should fall back to the 30-day default instead of
 *  breaking the screen. */
export function parsePeriod(query: unknown): { from?: Date; to?: Date } {
  const q = (query ?? {}) as { from?: string; to?: string };
  const parse = (s: string | undefined, fimDoDia: boolean): Date | undefined => {
    if (!s) return undefined;
    const d = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}Z` : s
    );
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const from = parse(q.from, false);
  const to = parse(q.to, true);
  // An inverted range is ignored too: showing the default beats showing an empty series.
  if (from && to && from > to) return {};
  return { from, to };
}

export async function insightsRoutes(app: FastifyInstance) {
  app.get("/analytics/profile-usage", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadProfileUsage(from, to));
    } catch (err) {
      app.log.error(err, "profile-usage failed, returning synthetic data");
      reply.send(syntheticProfileUsage());
    }
  });

  app.get("/analytics/conduct", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadConduct(from, to));
    } catch (err) {
      app.log.error(err, "conduct failed, returning synthetic data");
      reply.send(syntheticConduct());
    }
  });

  app.get("/analytics/user-activity", async (req, reply) => {
    try {
      const { from, to } = parsePeriod(req.query);
      reply.send(await loadUserActivity(from, to));
    } catch (err) {
      app.log.error(err, "user-activity failed, returning synthetic data");
      reply.send(syntheticUserActivity());
    }
  });
}
