import { describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { loadCostEstimate, loadCostFromAggregateCollection } from "./analytics.js";

/** Minimal fake satisfying just the Db methods these two functions call. */
function fakeDb(config: {
  transactions?: unknown[];
  users?: unknown[];
  aggregateCollectionRows?: {
    byModel?: unknown[];
    byArea?: unknown[];
    byEmail?: unknown[];
    verified?: unknown[];
    coverage?: unknown[];
  };
}): Db {
  const aggregateQueue = config.aggregateCollectionRows
    ? [
        config.aggregateCollectionRows.byModel ?? [],
        config.aggregateCollectionRows.byArea ?? [],
        config.aggregateCollectionRows.byEmail ?? [],
        config.aggregateCollectionRows.verified ?? [],
        config.aggregateCollectionRows.coverage ?? [],
      ]
    : null;
  let aggregateCallIndex = 0;

  return {
    collection: (name: string) => ({
      aggregate: () => ({
        toArray: async () => {
          if (name === "transactions") return config.transactions ?? [];
          if (name === "fato_uso_ia" || aggregateQueue) {
            return aggregateQueue?.[aggregateCallIndex++] ?? [];
          }
          return [];
        },
      }),
      find: () => ({
        toArray: async () => (name === "users" ? (config.users ?? []) : []),
      }),
    }),
  } as unknown as Db;
}

describe("loadCostEstimate", () => {
  it("prices tokens per model and rolls them up by role, marked as an estimate", async () => {
    const db = fakeDb({
      transactions: [
        { _id: { user: "u1", model: "gpt-5-mini" }, tokens: 10_000 },
        { _id: { user: "u2", model: "gpt-5-mini" }, tokens: 5_000 },
      ],
      users: [
        { _id: "u1", role: "ADMIN" },
        { _id: "u2", role: "basic-user" },
      ],
    });

    const result = await loadCostEstimate(db, new Date("2026-01-01"), new Date("2026-01-31"));

    expect(result.synthetic).toBe(false);
    expect(result.source).toBe("estimate");
    expect(result.currency).toBe("USD");
    // gpt-5-mini is $0.01 per 1k tokens (see pricing.ts) — 15k tokens total = $0.15.
    expect(result.totalEstimatedCost).toBeCloseTo(0.15);
    expect(result.byModel).toEqual([{ model: "gpt-5-mini", estimatedCost: 0.15, tokens: 15_000 }]);
    expect(result.byProfile.ADMIN.tokens).toBe(10_000);
    expect(result.byProfile["basic-user"].tokens).toBe(5_000);
    // Area/cost-center has no LibreChat-native source, so it must never be fabricated.
    expect(result.byArea).toEqual([]);
    // No aggregate-collection-only fields should be present in estimate mode.
    expect(result.coverage).toBeUndefined();
    expect(result.verifiedPrice).toBeUndefined();
  });

  it("returns zero cost, not a crash, when there is no consumption in the period", async () => {
    const db = fakeDb({ transactions: [], users: [{ _id: "u1", role: "ADMIN" }] });
    const result = await loadCostEstimate(db, new Date("2026-01-01"), new Date("2026-01-31"));
    expect(result.totalEstimatedCost).toBe(0);
    expect(result.byModel).toEqual([]);
  });
});

describe("loadCostFromAggregateCollection", () => {
  it("reads from the configured collection name, not a hardcoded one", async () => {
    const db = fakeDb({
      users: [{ _id: "u1", email: "person@example.com", role: "ADMIN" }],
      aggregateCollectionRows: {
        byModel: [{ _id: "gpt-5-mini", cost: 1.5, tokens: 1000 }],
        byEmail: [{ _id: "person@example.com", cost: 1.5, tokens: 1000 }],
        verified: [{ _id: true, cost: 1.5 }],
        coverage: [{ min: "2026-01-01", max: "2026-01-31", records: 10 }],
      },
    });

    const result = await loadCostFromAggregateCollection(
      db,
      new Date("2026-01-01"),
      new Date("2026-01-31"),
      "any_custom_collection_name"
    );

    expect(result.source).toBe("aggregate-collection");
    expect(result.totalEstimatedCost).toBeCloseTo(1.5);
    expect(result.byProfile.ADMIN.tokens).toBe(1000);
    expect(result.coverage).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      records: 10,
    });
  });
});
