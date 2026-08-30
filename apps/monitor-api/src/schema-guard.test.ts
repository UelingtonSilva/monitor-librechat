import { describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { checkSchemas } from "./schema-guard.js";

/** Minimal fake satisfying just the two Db methods schema-guard.ts calls. */
function fakeDb(
  data: Record<
    string,
    { sample: Record<string, unknown> | null; distinct?: Record<string, unknown[]> }
  >
): Db {
  return {
    collection: (name: string) => ({
      findOne: async () => data[name]?.sample ?? null,
      distinct: async (field: string) => data[name]?.distinct?.[field] ?? [],
    }),
  } as unknown as Db;
}

describe("checkSchemas", () => {
  it("reports ok when every expected collection has the required fields and known values", async () => {
    const db = fakeDb({
      transactions: {
        sample: {
          user: "u1",
          model: "gpt-5",
          tokenType: "prompt",
          rawAmount: -100,
          createdAt: new Date(),
        },
        distinct: { tokenType: ["prompt", "completion", "credits"] },
      },
      users: { sample: { role: "ADMIN" } },
      conversations: { sample: { user: "u1", createdAt: new Date() } },
      agents: { sample: { id: "a1", name: "Agent One" } },
    });

    const results = await checkSchemas(db);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => r.collection)).toEqual([
      "transactions",
      "users",
      "conversations",
      "agents",
    ]);
  });

  it("flags a missing required field instead of silently passing", async () => {
    const db = fakeDb({
      transactions: {
        sample: { user: "u1", model: "gpt-5", createdAt: new Date() }, // tokenType and rawAmount missing
        distinct: { tokenType: ["prompt"] },
      },
      users: { sample: { role: "ADMIN" } },
      conversations: { sample: { user: "u1", createdAt: new Date() } },
      agents: { sample: { id: "a1", name: "Agent One" } },
    });

    const results = await checkSchemas(db);
    const transactions = results.find((r) => r.collection === "transactions")!;
    expect(transactions.ok).toBe(false);
    expect(transactions.missingFields.sort()).toEqual(["rawAmount", "tokenType"]);
  });

  // Regression guard: this is the exact failure mode that already happened in production —
  // tokenType "credits" appeared with no warning and inflated every consumption figure until
  // token-types.ts's CONSUMPTION_ONLY filter was added. This check exists so a FOURTH value
  // gets flagged the moment it appears, instead of silently corrupting figures again.
  it("flags a tokenType value this codebase doesn't yet know how to handle", async () => {
    const db = fakeDb({
      transactions: {
        sample: {
          user: "u1",
          model: "gpt-5",
          tokenType: "prompt",
          rawAmount: -100,
          createdAt: new Date(),
        },
        distinct: { tokenType: ["prompt", "completion", "credits", "refund"] },
      },
      users: { sample: { role: "ADMIN" } },
      conversations: { sample: { user: "u1", createdAt: new Date() } },
      agents: { sample: { id: "a1", name: "Agent One" } },
    });

    const results = await checkSchemas(db);
    const transactions = results.find((r) => r.collection === "transactions")!;
    expect(transactions.ok).toBe(false);
    expect(transactions.unexpectedValues.tokenType).toEqual(["refund"]);
  });

  it("does not flag the three known tokenType values as drift", async () => {
    const db = fakeDb({
      transactions: {
        sample: {
          user: "u1",
          model: "gpt-5",
          tokenType: "credits",
          rawAmount: 400_000,
          createdAt: new Date(),
        },
        distinct: { tokenType: ["prompt", "completion", "credits"] },
      },
      users: { sample: { role: "ADMIN" } },
      conversations: { sample: { user: "u1", createdAt: new Date() } },
      agents: { sample: { id: "a1", name: "Agent One" } },
    });

    const results = await checkSchemas(db);
    expect(results.find((r) => r.collection === "transactions")!.ok).toBe(true);
  });

  it("treats an empty collection as ok rather than a false failure", async () => {
    const db = fakeDb({
      transactions: { sample: null },
      users: { sample: null },
      conversations: { sample: null },
      agents: { sample: null },
    });

    const results = await checkSchemas(db);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.every((r) => r.note.includes("empty"))).toBe(true);
  });
});
