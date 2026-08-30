import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Regression guard for a bug that reached production. db.transactions gained the tokenType
// "credits" (the daily budget top-up, context "autoRefill") AFTER this integration was
// written. Every query that summed rawAmount without filtering started counting granted
// credit as spent tokens: a user with 173k of real consumption displayed as 573k.
//
// There is no MongoDB in unit tests, so this inspects the source instead: every query
// against transactions must narrow by tokenType. It is deliberately blunt — it breaks if
// anyone adds a new aggregation without the filter, which is exactly the failure mode that
// already happened once.
const ROUTES_DIR = path.resolve(import.meta.dirname, "routes");

function sources(): Array<{ file: string; text: string }> {
  return fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(ROUTES_DIR, f), "utf8") }));
}

describe("tokenType filter on transactions queries", () => {
  it("every transactions query narrows by tokenType", () => {
    const unfiltered: string[] = [];
    for (const { file, text } of sources()) {
      // Each block starting a transactions query runs until the next collection or the end.
      const blocks = text.split('collection("transactions")').slice(1);
      for (const [i, block] of blocks.entries()) {
        const nextBlock = block.split('.collection("')[0];
        // Accepts either the literal or the shared CONSUMPTION_ONLY constant.
        const filtered = nextBlock.includes("tokenType") || nextBlock.includes("CONSUMPTION_ONLY");
        if (!filtered) unfiltered.push(`${file} (query #${i + 1})`);
      }
    }
    expect(unfiltered).toEqual([]);
  });

  it("uses a prompt/completion include list, not a credits exclusion", () => {
    // Excluding "credits" by name would break again the moment a fourth tokenType appears.
    // An include list is the safe shape.
    for (const { file, text } of sources()) {
      expect(text, `${file} must not exclude credits by name`).not.toMatch(
        /\$nin:\s*\[\s*["']credits["']/
      );
    }
  });
});
