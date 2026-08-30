import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression guard for a bug this project already shipped once.
 *
 * When the codebase was translated to English, a mechanical rename turned the aggregation
 * `_id: "$modelo"` into `_id: "$model"`. That string is a MongoDB field name, not an
 * identifier: the compiler saw nothing wrong, the query kept running, and the cost-by-model
 * breakdown would have silently returned an empty grouping in production.
 *
 * Some collections this project reads are produced by external jobs and use non-English
 * field names. They are data, not code, and must never be "translated". This test asserts
 * those names are still referenced verbatim.
 *
 * NOTE: detection anchors on the field-name strings themselves, not on how the collection is
 * looked up. The collection this data lives in is deployment-configurable (env.costCollectionName)
 * so `collection("fato_uso_ia")` is no longer guaranteed to appear as a literal in source —
 * but as long as the code that reads these fields exists at all, the field names themselves
 * must still appear verbatim.
 */
const SOURCE_DIR = path.resolve(import.meta.dirname, "routes");

/** Field names that must appear verbatim, with the collection that owns them. */
const EXTERNAL_FIELDS: Array<{ collection: string; fields: string[] }> = [
  {
    // Cost-apportioning collection maintained outside this project.
    collection: "fato_uso_ia",
    fields: ["$modelo", "$custo_usd", "$data", "$area", "$usuario_email", "$preco_verificado"],
  },
];

function allSource(): string {
  return fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => fs.readFileSync(path.join(SOURCE_DIR, f), "utf8"))
    .join("\n");
}

describe("external MongoDB field names", () => {
  const source = allSource();

  for (const { collection, fields } of EXTERNAL_FIELDS) {
    // Only assert when this integration is actually present in source, so removing it
    // entirely does not fail the suite. Detected by the first field name itself, not by the
    // collection lookup (literal vs. a configurable variable).
    const used = source.includes(`"${fields[0]}"`);
    for (const field of fields) {
      it(`${collection}: keeps ${field} verbatim`, () => {
        if (!used) return expect(used).toBe(false);
        expect(source, `${field} is a database field name and must not be renamed`).toContain(
          `"${field}"`
        );
      });
    }
  }

  it("does not reference $model on the cost collection", () => {
    // The exact regression: "$modelo" (the real field) turned into "$model". Anchor on the
    // real field name itself rather than on the collection lookup, since the collection name
    // is now a configurable variable, not always a literal string in source.
    const anchor = '_id: "$modelo"';
    const idx = source.indexOf(anchor);
    expect(
      idx,
      "expected to find the real $modelo field somewhere in source"
    ).toBeGreaterThanOrEqual(0);
    const nearby = source.slice(Math.max(0, idx - 200), idx + 200);
    expect(nearby).not.toContain('_id: "$model"');
  });
});
