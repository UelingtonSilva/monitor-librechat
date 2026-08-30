import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES_DIR = path.dirname(fileURLToPath(import.meta.url));
const LANGUAGES = ["en", "pt-BR"];

/** Flattens a nested JSON object into dotted key paths, e.g. {a: {b: 1}} -> ["a.b"]. */
function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return [prefix];
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

function namespacesFor(lng: string): string[] {
  const dir = path.join(LOCALES_DIR, lng);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

function loadKeys(lng: string, namespace: string): string[] {
  const file = path.join(LOCALES_DIR, lng, `${namespace}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf-8"));
  return flattenKeys(json).sort();
}

describe("i18n locale catalogs stay in sync", () => {
  const [primary, ...rest] = LANGUAGES;
  const primaryNamespaces = namespacesFor(primary);

  it("has at least one namespace", () => {
    expect(primaryNamespaces.length).toBeGreaterThan(0);
  });

  for (const lng of rest) {
    it(`${lng} defines exactly the same namespaces as ${primary}`, () => {
      expect(namespacesFor(lng)).toEqual(primaryNamespaces);
    });
  }

  for (const namespace of primaryNamespaces) {
    describe(`namespace "${namespace}"`, () => {
      const referenceKeys = loadKeys(primary, namespace);

      for (const lng of rest) {
        it(`${lng} has the same keys as ${primary}`, () => {
          const keys = loadKeys(lng, namespace);
          const missing = referenceKeys.filter((k) => !keys.includes(k));
          const extra = keys.filter((k) => !referenceKeys.includes(k));
          expect({ missing, extra }).toEqual({ missing: [], extra: [] });
        });
      }
    });
  }
});
