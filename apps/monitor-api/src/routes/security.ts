import type { FastifyInstance } from "fastify";
import type { SecurityStats, SecurityAlert } from "@monitor-librechat/shared";
import { getMongoDb } from "../mongo.js";
import { scanText, maskEvidence } from "../detectors.js";
import { loadPolicyCatalog } from "../policies.js";
import { loadAllowlists } from "../resources.js";
import { CONSUMPTION_ONLY } from "../token-types.js";
import { syntheticSecurity } from "../synthetic.js";

const MAX_MENSAGENS = 2000;

function emptySeveridade(): SecurityStats["bySeverity"] {
  return { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
}

// Runs in SHADOW mode: it analyses, records and displays, but never blocks anything. This
// tool reads the database after the fact; it does not sit in the request path and could not
// block even if asked to. Presenting it as enforcement would claim a control that does not
// exist.
export async function loadSecurity(): Promise<SecurityStats> {
  const db = await getMongoDb();
  if (!db) return syntheticSecurity();

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const catalog = new Map(loadPolicyCatalog().map((p) => [p.id, p]));
  const alerts: SecurityAlert[] = [];
  const bySeverity = emptySeveridade();

  const messages = await db
    .collection("messages")
    .find(
      { createdAt: { $gte: periodStart }, isCreatedByUser: true },
      { projection: { text: 1, user: 1, createdAt: 1 }, limit: MAX_MENSAGENS }
    )
    .toArray();

  for (const msg of messages) {
    const text = typeof msg.text === "string" ? msg.text : "";
    if (!text) continue;
    for (const hit of scanText(text)) {
      const policy = catalog.get(hit.policyId);
      if (!policy) continue;
      bySeverity[policy.severity] += 1;
      alerts.push({
        policyId: policy.id,
        policyName: policy.name,
        severity: policy.severity,
        subjectRef: `USR-${String(msg.user ?? "unknown")
          .slice(-8)
          .toUpperCase()}`,
        timestamp: (msg.createdAt instanceof Date ? msg.createdAt : periodEnd).toISOString(),
        evidenceMasked: maskEvidence(hit.match),
        decision: "ALLOW",
      });
    }
  }

  // GOV-001 — model outside the role's allowlist, compared against the live db.configs
  const [users, txModels, allowlists] = await Promise.all([
    db
      .collection("users")
      .find({}, { projection: { role: 1 } })
      .toArray(),
    db
      .collection("transactions")
      .aggregate([
        // A credit top-up has no model, so it would already fall out at the `!model` guard
        // below. Filtering at the source makes the intent explicit and the query smaller.
        { $match: { ...CONSUMPTION_ONLY, createdAt: { $gte: periodStart } } },
        { $group: { _id: { user: "$user", model: "$model" }, lastUsage: { $max: "$createdAt" } } },
      ])
      .toArray(),
    loadAllowlists(db),
  ]);
  const roleById = new Map(users.map((u) => [String(u._id), String(u.role ?? "USER")]));
  const govPolicy = catalog.get("GOV-001");

  for (const row of txModels) {
    const model = String(row._id?.model ?? "");
    const profile = roleById.get(String(row._id?.user)) ?? "USER";
    const allow = allowlists.get(profile);
    // Admin roles have no allowlist. A role with no config, or with enforce off, raises no
    // alert either: in that case LibreChat itself is not restricting anything, so reporting
    // "unauthorised model" would be a false positive.
    if (!govPolicy || !model || profile === "ADMIN") continue;
    if (!allow || !allow.enforce || allow.models.length === 0) continue;
    if (allow.models.includes(model)) continue;

    // Never judge usage that predates the allowlist. Without this, any configuration change
    // would turn the entire history into violations of the new rule. That happened during
    // validation: 13 alerts fired from an allowlist published three hours earlier, judging
    // weeks of prior usage.
    const usadoEm = row.lastUsage instanceof Date ? row.lastUsage : periodEnd;
    if (allow.effectiveSince && usadoEm < allow.effectiveSince) continue;

    bySeverity[govPolicy.severity] += 1;
    alerts.push({
      policyId: govPolicy.id,
      policyName: govPolicy.name,
      severity: govPolicy.severity,
      subjectRef: `USR-${String(row._id?.user ?? "")
        .slice(-8)
        .toUpperCase()}`,
      timestamp: (row.lastUsage instanceof Date ? row.lastUsage : periodEnd).toISOString(),
      evidenceMasked: `model "${model}" fora da allowlist do profile ${profile}`,
      decision: "ALLOW",
    });
  }

  alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    synthetic: false,
    mode: "SHADOW",
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalMessagesScanned: messages.length,
    bySeverity,
    alerts,
  };
}

export async function securityRoutes(app: FastifyInstance) {
  app.get("/analytics/security", async (_req, reply) => {
    try {
      reply.send(await loadSecurity());
    } catch (err) {
      app.log.error(err, "security scan failed, returning synthetic data");
      reply.send(syntheticSecurity());
    }
  });

  app.get("/policies", async () => ({ policies: loadPolicyCatalog() }));
}
