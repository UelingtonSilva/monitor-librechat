import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { PolicyCatalogItem } from "@monitor-librechat/shared";
import { env } from "./env.js";

let cache: PolicyCatalogItem[] | null = null;

export function loadPolicyCatalog(): PolicyCatalogItem[] {
  if (cache) return cache;

  if (!fs.existsSync(env.policiesDir)) {
    cache = [];
    return cache;
  }

  // Matches policy filenames only (e.g. GOV-001.yaml), not other YAML config files that also
  // live under this directory, such as mcp-integrations.yaml.
  const files = fs.readdirSync(env.policiesDir).filter((f) => /^[A-Z]+-\d{3}\.yaml$/.test(f));
  cache = files
    .map((file) => {
      const raw = parse(fs.readFileSync(path.join(env.policiesDir, file), "utf-8"));
      return {
        id: raw.id,
        version: raw.version,
        name: raw.name,
        domain: raw.domain,
        severity: raw.severity,
        detection: raw.detection,
        mode: raw.mode,
        implemented: Boolean(raw.implemented),
        note: raw.note ?? "",
        owner: raw.owner ?? "governance",
        reviewCycleDays: raw.review_cycle_days ?? 90,
      } satisfies PolicyCatalogItem;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return cache;
}
