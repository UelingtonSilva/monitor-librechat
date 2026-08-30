import { describe, it, expect, vi } from "vitest";
import type { Db } from "mongodb";

// Exercises the actual dispatcher a fresh deployer's request would hit — not just the two
// cost-computation helpers in isolation — by mocking only the Mongo connection itself. This
// is the piece that answers "does this actually pick the right path for someone else's
// deployment", not just "is the math right once it picks one".
const mockEnv: { costCollectionName: string | null } = { costCollectionName: null };
vi.mock("../env.js", () => ({ env: mockEnv }));

let currentDb: Db | null = null;
vi.mock("../mongo.js", () => ({
  getMongoDb: async () => currentDb,
  isMongoConfigured: () => true,
}));

const { loadCost } = await import("./analytics.js");

/** A fake Db whose named collections may or may not "exist", each with canned aggregate rows. */
function fakeDb(options: {
  existingCollections: string[];
  transactions?: unknown[];
  users?: unknown[];
  aggregateRowsByCollection?: Record<string, unknown[][]>;
}): Db {
  const callIndex = new Map<string, number>();
  return {
    listCollections: (filter: { name: string }) => ({
      toArray: async () =>
        options.existingCollections.includes(filter.name) ? [{ name: filter.name }] : [],
    }),
    collection: (name: string) => ({
      aggregate: () => ({
        toArray: async () => {
          if (name === "transactions") return options.transactions ?? [];
          const rows = options.aggregateRowsByCollection?.[name] ?? [];
          const i = callIndex.get(name) ?? 0;
          callIndex.set(name, i + 1);
          return rows[i] ?? [];
        },
      }),
      find: () => ({ toArray: async () => (name === "users" ? (options.users ?? []) : []) }),
    }),
  } as unknown as Db;
}

describe("loadCost dispatch", () => {
  it("falls back to the estimate when no cost collection is configured at all", async () => {
    mockEnv.costCollectionName = null;
    currentDb = fakeDb({ existingCollections: [], transactions: [], users: [] });

    const result = await loadCost();
    expect(result.source).toBe("estimate");
  });

  it("falls back to the estimate when a collection name IS configured but doesn't exist", async () => {
    mockEnv.costCollectionName = "case_2_missing_collection";
    currentDb = fakeDb({ existingCollections: [], transactions: [], users: [] });

    const result = await loadCost();
    expect(result.source).toBe("estimate");
  });

  it("uses the aggregate collection once it's confirmed to exist", async () => {
    mockEnv.costCollectionName = "case_3_present_collection";
    currentDb = fakeDb({
      existingCollections: ["case_3_present_collection"],
      users: [{ _id: "u1", email: "a@example.com", role: "ADMIN" }],
      aggregateRowsByCollection: {
        case_3_present_collection: [
          [{ _id: "gpt-5-mini", cost: 2, tokens: 500 }], // byModel
          [], // byArea
          [{ _id: "a@example.com", cost: 2, tokens: 500 }], // byEmail
          [{ _id: true, cost: 2 }], // verified
          [{ min: "2026-01-01", max: "2026-01-31", records: 5 }], // coverage
        ],
      },
    });

    const result = await loadCost();
    expect(result.source).toBe("aggregate-collection");
    expect(result.totalEstimatedCost).toBeCloseTo(2);
  });

  it("returns synthetic data with no Mongo connection at all, regardless of config", async () => {
    mockEnv.costCollectionName = "irrelevant";
    currentDb = null;

    const result = await loadCost();
    expect(result.synthetic).toBe(true);
  });
});
