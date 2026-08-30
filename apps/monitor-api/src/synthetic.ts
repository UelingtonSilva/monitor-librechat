import type {
  AdoptionStats,
  UsageStats,
  CostStats,
  McpAuditStats,
  SecurityStats,
  AdoptionTrend,
  CostTrend,
  TrendPoint,
  ProfileUsageStats,
  ConductStats,
  TokenBucket,
  UserActivityStats,
} from "@monitor-librechat/shared";

function periodWindow(days = 30) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
}

function series(days: number, base: number, amplitude: number): TrendPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    return {
      date: date.toISOString().slice(0, 10),
      value: Number((base + Math.sin(i / 3) * amplitude).toFixed(2)),
    };
  });
}

export function syntheticAdoption(): AdoptionStats {
  return {
    synthetic: true,
    ...periodWindow(),
    enabledUsers: 19,
    dau: 6,
    wau: 13,
    mau: 18,
    activationRate: 0.68,
    byProfile: {
      ADMIN: { enabled: 2, activeInPeriod: 2 },
      executive: { enabled: 2, activeInPeriod: 1 },
      "power-user": { enabled: 5, activeInPeriod: 5 },
      "standard-user": { enabled: 1, activeInPeriod: 1 },
      "basic-user": { enabled: 9, activeInPeriod: 7 },
    },
  };
}

export function syntheticUsage(): UsageStats {
  return {
    synthetic: true,
    ...periodWindow(),
    totalPrompts: 842,
    totalConversations: 231,
    inputTokens: 512_000,
    outputTokens: 298_000,
    filesGenerated: 12,
    byModel: [
      { model: "gpt-5-mini", prompts: 310, tokens: 210_000 },
      { model: "claude-sonnet-4-6", prompts: 220, tokens: 180_000 },
      { model: "gemini-2.5-flash", prompts: 180, tokens: 140_000 },
      { model: "claude-opus-4-8", prompts: 90, tokens: 160_000 },
      { model: "gpt-5.5", prompts: 42, tokens: 120_000 },
    ],
    byAgent: [
      { agentId: "sales-insights", name: "Sales Insights", uses: 64 },
      { agentId: "marketing-insights", name: "Marketing Insights", uses: 37 },
    ],
  };
}

export function syntheticCost(): CostStats {
  return {
    synthetic: true,
    source: "aggregate-collection",
    ...periodWindow(),
    totalEstimatedCost: 3.64,
    currency: "USD",
    coverage: { startDate: "2026-08-11", endDate: "2026-08-15", records: 76 },
    verifiedPrice: { verified: 2.51, unverified: 1.13 },
    byProfile: {
      ADMIN: { estimatedCost: 0.42, tokens: 60_000 },
      executive: { estimatedCost: 0.81, tokens: 90_000 },
      "power-user": { estimatedCost: 1.34, tokens: 210_000 },
      "standard-user": { estimatedCost: 0.18, tokens: 25_000 },
      "basic-user": { estimatedCost: 0.89, tokens: 425_000 },
    },
    byModel: [
      { model: "claude-opus-4-8", estimatedCost: 1.52, tokens: 160_000 },
      { model: "gpt-5.5", estimatedCost: 0.86, tokens: 120_000 },
      { model: "claude-sonnet-4-6", estimatedCost: 0.71, tokens: 180_000 },
      { model: "gpt-5-mini", estimatedCost: 0.34, tokens: 210_000 },
      { model: "gemini-2.5-flash", estimatedCost: 0.21, tokens: 140_000 },
    ],
    byArea: [
      { area: "IT", estimatedCost: 1.98, tokens: 380_000 },
      { area: "BI", estimatedCost: 1.02, tokens: 240_000 },
      { area: "TBD", estimatedCost: 0.41, tokens: 95_000 },
      { area: "UNMAPPED", estimatedCost: 0.23, tokens: 55_000 },
    ],
  };
}

export function syntheticSecurity(): SecurityStats {
  const now = new Date().toISOString();
  return {
    synthetic: true,
    mode: "SHADOW",
    ...periodWindow(),
    totalMessagesScanned: 842,
    bySeverity: { info: 0, low: 0, medium: 2, high: 1, critical: 1 },
    alerts: [
      {
        policyId: "SEC-001",
        policyName: "Credential or API key exposure",
        severity: "critical",
        subjectRef: "USR-EXAMPLE01",
        timestamp: now,
        evidenceMasked: "sk-F****************9012",
        decision: "ALLOW",
      },
      {
        policyId: "GOV-001",
        policyName: "Model outside the role's allowlist",
        severity: "high",
        subjectRef: "USR-EXAMPLE03",
        timestamp: now,
        evidenceMasked: 'model "opus-5" outside the basic-user role allowlist',
        decision: "ALLOW",
      },
      {
        policyId: "PRIV-001",
        policyName: "National ID or personal identifier",
        severity: "medium",
        subjectRef: "USR-EXAMPLE02",
        timestamp: now,
        evidenceMasked: "123.***-00",
        decision: "ALLOW",
      },
      {
        policyId: "PRIV-001",
        policyName: "National ID or personal identifier",
        severity: "medium",
        subjectRef: "USR-EXAMPLE04",
        timestamp: now,
        evidenceMasked: "987.***-11",
        decision: "ALLOW",
      },
    ],
  };
}

export function syntheticAdoptionTrend(): AdoptionTrend {
  return { synthetic: true, ...periodWindow(), dauSeries: series(30, 6, 3) };
}

export function syntheticCostTrend(): CostTrend {
  return { synthetic: true, ...periodWindow(), costSeries: series(30, 6.2, 2.5) };
}

export function syntheticProfileUsage(): ProfileUsageStats {
  return {
    synthetic: true,
    ...periodWindow(),
    profiles: [
      {
        profile: "ADMIN",
        users: 2,
        active: 2,
        totalTokens: 1_000_477,
        tokensPerActive: 500_239,
        promptsPerActive: 56,
        conversationsPerActive: 9.5,
        avgActiveDays: 4,
        distinctModels: 14,
        distinctAgents: 3,
      },
      {
        profile: "power-user",
        users: 5,
        active: 3,
        totalTokens: 522_873,
        tokensPerActive: 174_291,
        promptsPerActive: 6,
        conversationsPerActive: 2.3,
        avgActiveDays: 1,
        distinctModels: 3,
        distinctAgents: 1,
      },
      {
        profile: "basic-user",
        users: 9,
        active: 4,
        totalTokens: 90_842,
        tokensPerActive: 22_711,
        promptsPerActive: 10.8,
        conversationsPerActive: 1.5,
        avgActiveDays: 1.5,
        distinctModels: 9,
        distinctAgents: 0,
      },
      {
        profile: "standard-user",
        users: 1,
        active: 1,
        totalTokens: 24_808,
        tokensPerActive: 24_808,
        promptsPerActive: 15,
        conversationsPerActive: 8,
        avgActiveDays: 1,
        distinctModels: 4,
        distinctAgents: 0,
      },
      {
        profile: "executive",
        users: 2,
        active: 0,
        totalTokens: 0,
        tokensPerActive: 0,
        promptsPerActive: 0,
        conversationsPerActive: 0,
        avgActiveDays: 0,
        distinctModels: 0,
        distinctAgents: 0,
      },
    ],
  };
}

export function syntheticConduct(): ConductStats {
  const buckets = 48;
  const series: TokenBucket[] = Array.from({ length: buckets }, (_, i) => {
    const timestamp = new Date(Date.now() - (buckets - 1 - i) * 60 * 60 * 1000).toISOString();
    return {
      timestamp,
      input: Math.round(18_000 + Math.sin(i / 4) * 6000),
      output: Math.round(1_200 + Math.sin(i / 4 + 1) * 400),
    };
  });
  return {
    synthetic: true,
    bucketMinutes: 60,
    zScore: 0.6,
    state: "normal",
    reason: "Consumption within the expected band (20h window).",
    series,
  };
}

export function syntheticUserActivity(): UserActivityStats {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
  return {
    synthetic: true,
    ...periodWindow(),
    // Sorted by lastAccess descending, matching the real payload. Includes inactive users and
    // one who never signed in, so the modal exercises all three states.
    users: [
      {
        name: "Example User 01 (ADMIN)",
        profile: "ADMIN",
        active: true,
        totalTokens: 775_386,
        prompts: 59,
        lastAccessSource: "usage",
        lastAccess: hoursAgo(1),
      },
      {
        name: "Example User 03 (ADMIN)",
        profile: "ADMIN",
        active: true,
        totalTokens: 225_091,
        prompts: 53,
        lastAccessSource: "usage",
        lastAccess: hoursAgo(2),
      },
      {
        name: "Example User 06",
        profile: "standard-user",
        active: true,
        totalTokens: 24_808,
        prompts: 15,
        lastAccessSource: "usage",
        lastAccess: hoursAgo(30),
      },
      {
        name: "Example User 04",
        profile: "basic-user",
        active: true,
        totalTokens: 68_850,
        prompts: 22,
        lastAccessSource: "usage",
        lastAccess: hoursAgo(50),
      },
      {
        name: "Example User 05",
        profile: "power-user",
        active: true,
        totalTokens: 48_158,
        prompts: 5,
        lastAccessSource: "usage",
        lastAccess: hoursAgo(120),
      },
      {
        name: "Example User 02",
        profile: "power-user",
        active: true,
        totalTokens: 454_914,
        prompts: 7,
        lastAccessSource: "usage",
        lastAccess: hoursAgo(140),
      },
      {
        name: "Example User 07 (inactive)",
        profile: "basic-user",
        active: false,
        totalTokens: 0,
        prompts: 0,
        lastAccessSource: "login",
        lastAccess: hoursAgo(900),
      },
      {
        name: "Example User 08 (never signed in)",
        profile: "executive",
        active: false,
        totalTokens: 0,
        prompts: 0,
        lastAccessSource: "login",
        lastAccess: null,
      },
    ],
  };
}

export function syntheticMcpAudit(): McpAuditStats {
  return {
    synthetic: true,
    ...periodWindow(7),
    entries: [
      {
        timestamp: new Date().toISOString(),
        service: "mcp-auth-proxy",
        subjectRef: "USR-EXAMPLE01",
        action: "monthly_revenue_report",
        resource: "Sales Insights",
      },
      {
        timestamp: new Date().toISOString(),
        service: "mcp-cmo-proxy",
        subjectRef: "USR-EXAMPLE02",
        action: "competitor_analysis",
        resource: "Marketing Insights",
      },
    ],
  };
}
