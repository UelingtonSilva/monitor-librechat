import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function withPoliciesDir(dir: string) {
  vi.doMock("./env.js", () => ({ env: { policiesDir: dir } }));
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./env.js");
});

describe("loadPolicyCatalog", () => {
  it("parses real policy files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-policies-test-"));
    fs.writeFileSync(
      path.join(dir, "SEC-001.yaml"),
      [
        "id: SEC-001",
        "version: 1",
        "name: Credential exposure",
        "domain: security",
        "severity: critical",
        "detection: deterministic",
        "mode: shadow",
        "implemented: true",
      ].join("\n")
    );
    withPoliciesDir(dir);

    const { loadPolicyCatalog } = await import("./policies.js");
    const catalog = loadPolicyCatalog();

    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe("SEC-001");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Regression guard: mcp-integrations.yaml lives in the same directory as the policy
  // catalog (see resources.ts, F2) but is a different kind of config entirely. An earlier
  // version of this loader's filter (`*.yaml`) would have swept it in and produced a
  // malformed policy entry with every field undefined.
  it("does not pick up mcp-integrations.yaml or other non-policy YAML files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-policies-mixed-"));
    fs.writeFileSync(
      path.join(dir, "SEC-001.yaml"),
      ["id: SEC-001", "version: 1", "name: X", "domain: security", "severity: low"].join("\n")
    );
    fs.writeFileSync(
      path.join(dir, "mcp-integrations.yaml"),
      ["visible_to_roles:", "  - ADMIN", "integrations: []"].join("\n")
    );
    withPoliciesDir(dir);

    const { loadPolicyCatalog } = await import("./policies.js");
    const catalog = loadPolicyCatalog();

    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe("SEC-001");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
