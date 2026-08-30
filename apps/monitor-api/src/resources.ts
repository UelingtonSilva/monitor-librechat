import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { Db } from "mongodb";
import { env } from "./env.js";

export interface RoleAllowlist {
  role: string;
  models: string[];
  enforce: boolean;
  /** When this role's allowlist took effect. Usage before this date must not be judged by
   *  it, or the result is a retroactive alert against a rule that did not exist yet. */
  effectiveSince: Date | null;
}

// The per-role model allowlist lives in db.configs (overrides.modelSpecs.list[].preset.model)
// and is LibreChat's own source of truth. Reading it live beats mirroring it in code: a stale
// mirror would raise a false GOV-001 alert every time someone changed the configuration
// through the admin panel.
export async function loadAllowlists(db: Db): Promise<Map<string, RoleAllowlist>> {
  const configs = await db
    .collection("configs")
    .find(
      { principalType: "role", isActive: { $ne: false } },
      { projection: { principalId: 1, "overrides.modelSpecs": 1, updatedAt: 1 } }
    )
    .toArray();

  const map = new Map<string, RoleAllowlist>();
  for (const cfg of configs) {
    const specs = cfg.overrides?.modelSpecs;
    const models: string[] = (specs?.list ?? [])
      .map((m: { preset?: { model?: string } }) => m.preset?.model)
      .filter((m: string | undefined): m is string => Boolean(m));
    map.set(String(cfg.principalId), {
      role: String(cfg.principalId),
      models,
      enforce: Boolean(specs?.enforce),
      effectiveSince: cfg.updatedAt instanceof Date ? cfg.updatedAt : null,
    });
  }
  return map;
}

export interface McpIntegration {
  mcpId: string;
  name: string;
  webSearch: boolean;
}

interface McpConfig {
  visibleToRoles: Set<string>;
  integrations: McpIntegration[];
}

let mcpConfigCache: McpConfig | null = null;

// Which roles may use MCP integrations, and which integrations exist at all. LibreChat has no
// dedicated field for this in db.configs, so it lives in a YAML file next to the policy
// catalog (policies/mcp-integrations.yaml) — configuration, not code, so a new deployment
// doesn't need to fork and rebuild to plug in its own integrations. Ships with placeholder
// values; see that file's own header comment.
function loadMcpConfig(): McpConfig {
  if (mcpConfigCache) return mcpConfigCache;

  const file = path.join(env.policiesDir, "mcp-integrations.yaml");
  if (!fs.existsSync(file)) {
    mcpConfigCache = { visibleToRoles: new Set(), integrations: [] };
    return mcpConfigCache;
  }

  const raw = parse(fs.readFileSync(file, "utf-8")) ?? {};
  mcpConfigCache = {
    visibleToRoles: new Set((raw.visible_to_roles ?? []) as string[]),
    integrations: ((raw.integrations ?? []) as Array<Record<string, unknown>>).map((m) => ({
      mcpId: String(m.id),
      name: String(m.name),
      webSearch: Boolean(m.web_search),
    })),
  };
  return mcpConfigCache;
}

export function mcpAllowedForRole(role: string): boolean {
  return loadMcpConfig().visibleToRoles.has(role);
}

export function loadCorporateMcps(): McpIntegration[] {
  return loadMcpConfig().integrations;
}
