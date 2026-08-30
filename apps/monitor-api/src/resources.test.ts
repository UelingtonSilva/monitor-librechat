import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// The MCP integration catalog is read from a YAML file next to the policy catalog (see
// resources.ts, F2), not hardcoded in source — this exercises the real file-reading path
// with a real temp directory, not a mock of fs itself.
function withPoliciesDir(dir: string) {
  vi.doMock("./env.js", () => ({ env: { policiesDir: dir } }));
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./env.js");
});

describe("MCP integration config", () => {
  it("reads roles and integrations from mcp-integrations.yaml", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-mcp-test-"));
    fs.writeFileSync(
      path.join(dir, "mcp-integrations.yaml"),
      [
        "visible_to_roles:",
        "  - ADMIN",
        "  - power-user",
        "integrations:",
        "  - id: crm-lookup",
        "    name: CRM Lookup",
        "    web_search: true",
      ].join("\n")
    );
    withPoliciesDir(dir);

    const { mcpAllowedForRole, loadCorporateMcps } = await import("./resources.js");

    expect(mcpAllowedForRole("ADMIN")).toBe(true);
    expect(mcpAllowedForRole("power-user")).toBe(true);
    expect(mcpAllowedForRole("basic-user")).toBe(false);
    expect(loadCorporateMcps()).toEqual([
      { mcpId: "crm-lookup", name: "CRM Lookup", webSearch: true },
    ]);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to nothing visible when the file is missing, not a crash", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-mcp-empty-"));
    withPoliciesDir(dir);

    const { mcpAllowedForRole, loadCorporateMcps } = await import("./resources.js");

    expect(mcpAllowedForRole("ADMIN")).toBe(false);
    expect(loadCorporateMcps()).toEqual([]);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
