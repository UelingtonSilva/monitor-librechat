import type {
  AdoptionStats,
  UsageStats,
  CostStats,
  McpAuditStats,
  SecurityStats,
  PolicyCatalog,
  ResourcesCatalog,
  AuditLog,
  OperationalStatus,
  AdoptionTrend,
  CostTrend,
  ProfileUsageStats,
  ConductStats,
  UserActivityStats,
} from "@monitor-librechat/shared";

// In production the portal is served by the API itself, so a relative "/api/v1" is the right
// default. In development the .env points at the local API port.
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || `${import.meta.env.BASE_URL}api/v1`.replace("//", "/");

export class Unauthenticated extends Error {}

/** Period selected on the dashboard. Dates as YYYY-MM-DD; absent means the backend default. */
export interface Period {
  from?: string;
  to?: string;
}

function qs(period?: Period): string {
  if (!period?.from && !period?.to) return "";
  const p = new URLSearchParams();
  if (period.from) p.set("from", period.from);
  if (period.to) p.set("to", period.to);
  return `?${p.toString()}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: "same-origin" });
  if (res.status === 401) throw new Unauthenticated("sessao expirada");
  if (!res.ok) throw new Error(`${path} respondeu ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((msg as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (user: string, password: string) =>
    post<{ user: string }>("/auth/login", { user, password }),
  logout: () => post<{ ok: boolean }>("/auth/logout"),
  me: () => get<{ user: string }>("/auth/me"),
  getAdoption: (period?: Period) => get<AdoptionStats>(`/analytics/adoption${qs(period)}`),
  getUsage: (period?: Period) => get<UsageStats>(`/analytics/usage${qs(period)}`),
  getCost: (period?: Period) => get<CostStats>(`/analytics/cost${qs(period)}`),
  getMcpAudit: () => get<McpAuditStats>("/analytics/mcp-audit"),
  getSecurity: () => get<SecurityStats>("/analytics/security"),
  getAdoptionTrend: (period?: Period) =>
    get<AdoptionTrend>(`/analytics/adoption-trend${qs(period)}`),
  getCostTrend: (period?: Period) => get<CostTrend>(`/analytics/cost-trend${qs(period)}`),
  getPolicies: () => get<PolicyCatalog>("/policies"),
  getResources: () => get<ResourcesCatalog>("/resources"),
  getAudit: () => get<AuditLog>("/audit"),
  getStatus: () => get<OperationalStatus>("/status"),
  getProfileUsage: (period?: Period) =>
    get<ProfileUsageStats>(`/analytics/profile-usage${qs(period)}`),
  getConduct: (period?: Period) => get<ConductStats>(`/analytics/conduct${qs(period)}`),
  getUserActivity: (period?: Period) =>
    get<UserActivityStats>(`/analytics/user-activity${qs(period)}`),
};
