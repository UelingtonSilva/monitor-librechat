/**
 * Shared contract between the API and the portal.
 *
 * Every stats payload carries `synthetic`. When true, the API could not reach MongoDB and
 * is returning example data so the UI stays explorable — the portal must surface that
 * clearly instead of presenting example numbers as real ones.
 */

/**
 * A LibreChat role name, exactly as stored in `users.role`.
 *
 * Deliberately a plain string: role names are whatever the LibreChat instance defines, so
 * hardcoding a union here would only fit one deployment. Discover them from the data.
 */
export type Profile = string;

/**
 * Display name for a role.
 *
 * Some deployments prefix role names with digits to control ordering in the LibreChat UI
 * (`01-Basic`, `02-Advanced`). Stripping that prefix is a display convenience and a no-op
 * for role names that do not use the convention.
 */
export function profileLabel(profile: string): string {
  return profile.replace(/^\d+-/, "");
}

export interface AdoptionStats {
  synthetic: boolean;
  periodStart: string;
  periodEnd: string;
  enabledUsers: number;
  /** Distinct users with consumption in the last 1 / 7 days. Fixed windows by definition. */
  dau: number;
  wau: number;
  /** Distinct users with consumption in the selected period (not a fixed 30-day window). */
  mau: number;
  activationRate: number;
  byProfile: Record<string, { enabled: number; activeInPeriod: number }>;
}

export interface UsageStats {
  synthetic: boolean;
  periodStart: string;
  periodEnd: string;
  totalPrompts: number;
  totalConversations: number;
  inputTokens: number;
  outputTokens: number;
  /** null when `db.files` could not be queried — do not read it as "zero files". */
  filesGenerated: number | null;
  byModel: Array<{ model: string; prompts: number; tokens: number }>;
  byAgent: Array<{ agentId: string; name: string; uses: number }>;
}

/**
 * Where cost figures come from.
 *
 * `aggregate-collection` means a pre-computed cost collection exists in the database and was
 * used — real apportioned cost, typically with a verified-price flag. `estimate` means cost
 * was derived from token counts times a local price table, which is an approximation and is
 * labelled as such in the UI.
 */
export type CostSource = "aggregate-collection" | "estimate";

export interface CostStats {
  synthetic: boolean;
  source: CostSource;
  periodStart: string;
  periodEnd: string;
  totalEstimatedCost: number;
  currency: "BRL" | "USD";
  /**
   * Actual span the cost data covers, when it comes from an aggregate collection maintained
   * outside this project. It can be narrower than the requested period, so the UI must say
   * so rather than implying the total covers the whole window.
   */
  coverage?: { startDate: string; endDate: string; records: number };
  /** Share of the total whose price is flagged as verified at the source. */
  verifiedPrice?: { verified: number; unverified: number };
  byProfile: Record<string, { estimatedCost: number; tokens: number }>;
  byModel: Array<{ model: string; estimatedCost: number; tokens: number }>;
  byArea: Array<{ area: string; estimatedCost: number; tokens: number }>;
}

export interface McpAuditEntry {
  timestamp: string;
  service: string;
  /** Pseudonymised user reference. MCP audit never exposes real identities. */
  subjectRef: string;
  action: string;
  resource: string | null;
}

export interface McpAuditStats {
  synthetic: boolean;
  periodStart: string;
  periodEnd: string;
  entries: McpAuditEntry[];
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  mongoConnected: boolean;
  version: string;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface AdoptionTrend {
  synthetic: boolean;
  periodStart: string;
  periodEnd: string;
  dauSeries: TrendPoint[];
}

export interface CostTrend {
  synthetic: boolean;
  periodStart: string;
  periodEnd: string;
  costSeries: TrendPoint[];
}

export type PolicyMode = "shadow" | "advisory" | "enforcement" | "log" | "alert" | "fail-open";

export interface PolicyCatalogItem {
  id: string;
  version: number;
  name: string;
  domain: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  detection: string;
  mode: PolicyMode;
  /** false = catalogued for traceability but not detecting anything yet. */
  implemented: boolean;
  note: string;
  owner: string;
  reviewCycleDays: number;
}

export interface PolicyCatalog {
  policies: PolicyCatalogItem[];
}

export interface SecurityAlert {
  policyId: string;
  policyName: string;
  severity: PolicyCatalogItem["severity"];
  subjectRef: string;
  timestamp: string;
  /** Always masked. Raw matched content is never persisted or returned. */
  evidenceMasked: string;
  /** Always ALLOW in this release: detection runs in shadow mode and blocks nothing. */
  decision: "ALLOW" | "WARN" | "BLOCK";
}

export interface SecurityStats {
  synthetic: boolean;
  mode: "SHADOW";
  periodStart: string;
  periodEnd: string;
  totalMessagesScanned: number;
  bySeverity: Record<SecurityAlert["severity"], number>;
  alerts: SecurityAlert[];
}

export interface ResourceProfileInfo {
  profile: string;
  users: number;
  allowedModels: string[];
  /** true when LibreChat has `modelSpecs.enforce` on for this role. */
  enforce: boolean;
  mcpAllowed: boolean;
}

export interface ResourcesCatalog {
  profiles: ResourceProfileInfo[];
  agents: Array<{ agentId: string; name: string; uses: number }>;
  mcps: Array<{ mcpId: string; name: string; webSearch: boolean }>;
}

/**
 * Per-role usage, normalised by ACTIVE user rather than by enabled user.
 *
 * Comparing roles by total would mostly measure team size — a role with nine people always
 * looks heavier than a role with one. Per active user compares behaviour instead.
 */
export interface ProfileUsagePoint {
  profile: string;
  users: number;
  active: number;
  totalTokens: number;
  tokensPerActive: number;
  promptsPerActive: number;
  conversationsPerActive: number;
  avgActiveDays: number;
  distinctModels: number;
  distinctAgents: number;
}

export interface ProfileUsageStats {
  synthetic: boolean;
  periodStart: string;
  periodEnd: string;
  profiles: ProfileUsagePoint[];
}

export interface TokenBucket {
  /** Bucket start, ISO 8601. Width is given by `bucketMinutes` on the response. */
  timestamp: string;
  input: number;
  output: number;
}

export type ConductState = "normal" | "warning" | "critical";

export type ConductCauseKind = "token-volume-anomaly" | "security-detection";

/**
 * One signal that actually contributed to the Conduct semaphore, kept as its own entry
 * regardless of whether it is the one that ended up deciding `state`.
 *
 * Before this existed, only the single "winning" signal's text survived into the API
 * response: a critical-severity detection would silently swallow a simultaneous z-score
 * anomaly (or vice-versa), so the Portal's Conduct dialog could show "Critical" with no
 * detections listed and no way to tell why. Every non-normal signal is now recorded here.
 */
export interface ConductCause {
  kind: ConductCauseKind;
  /** Never "normal" — a cause is only ever recorded when it is not. */
  severity: Exclude<ConductState, "normal">;
  summary: string;
  /** Present only when `kind` is "token-volume-anomaly". */
  tokenAnomaly?: {
    zScore: number;
    bucketTokens: number;
    meanTokens: number;
    stdDevTokens: number;
    windowBuckets: number;
    /** ISO 8601 start of the bucket that triggered the anomaly. */
    bucketTimestamp: string;
  };
  /** Present only when `kind` is "security-detection". */
  securityDetection?: {
    criticalCount: number;
    highCount: number;
  };
}

/**
 * Statistical conduct signal: how far the latest period sits from normal behaviour
 * (moving mean plus/minus standard deviation), not a count of violated rules.
 *
 * This catches deviation no deterministic rule would predict — a consumption spike outside
 * business hours violates no policy but is anomalous. A critical or high policy detection
 * forces `critical` regardless of the z-score: statistics must never silence an exposed
 * secret.
 */
export interface ConductStats {
  synthetic: boolean;
  bucketMinutes: number;
  /** null when there is not enough history to compute the band. */
  zScore: number | null;
  state: ConductState;
  /** Combined summary of every cause below, kept for a compact one-line display. */
  reason: string;
  /** Every signal considered while computing `state`, so a UI can show all of them. */
  causes: ConductCause[];
  series: TokenBucket[];
}

export interface UserActivityPoint {
  /** Display name from `users.name`, falling back to username or email. */
  name: string;
  profile: string;
  /**
   * Active = had CONSUMPTION in the period, matching the `mau` shown on the users tile so
   * the two numbers agree. Someone who only signed in shows as inactive but still has a
   * last-access date — which is the useful signal in that case ("came in, did not use it").
   */
  active: boolean;
  totalTokens: number;
  prompts: number;
  /**
   * Most recent of sign-in and actual usage.
   *
   * LibreChat has no explicit last-login field. Using only the session would understate it:
   * sessions are long-lived and are not recreated per visit, so an already-signed-in user
   * can work for days without the timestamp moving.
   */
  lastAccess: string | null;
  /** Which signal produced `lastAccess`, so the date is auditable rather than opaque. */
  lastAccessSource: "login" | "usage" | null;
}

export interface UserActivityStats {
  synthetic: boolean;
  periodStart: string;
  periodEnd: string;
  /** Sorted by `lastAccess` descending; users with none go last. */
  users: UserActivityPoint[];
}

export interface AuditEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  correlationId: string;
}

export interface AuditLog {
  note: string;
  entries: AuditEntry[];
}

export interface SloTarget {
  name: string;
  target: string;
  note: string;
}

/** Result of comparing one LibreChat collection against the shape this codebase's queries
 *  assume. Purely observational — a failing check never blocks anything, it only means a
 *  figure derived from that collection may need a second look. */
export interface SchemaCheck {
  collection: string;
  ok: boolean;
  missingFields: string[];
  /** field -> values seen in the database that this codebase doesn't yet know how to handle. */
  unexpectedValues: Record<string, string[]>;
  note: string;
}

/** Whether one of this project's OPTIONAL integrations (things that are off unless a
 *  deployment specifically configures them) is actually wired up right now, and why. This is
 *  the onboarding answer to "what will and won't work for my deployment" — distinct from
 *  SchemaCheck, which is about whether an EXPECTED collection matches its assumed shape. */
export interface FeatureStatus {
  feature: string;
  enabled: boolean;
  note: string;
}

export interface OperationalStatus {
  status: HealthStatus["status"];
  mongoConnected: boolean;
  /** Sanitized reason the last connection attempt failed (never the connection string), or
   *  null when connected / never attempted. */
  mongoError: string | null;
  version: string;
  uptimeSec: number;
  sloTargets: SloTarget[];
  schemaChecks: SchemaCheck[];
  featureStatus: FeatureStatus[];
}
