import type { Db } from "mongodb";
import type { SchemaCheck } from "@monitor-librechat/shared";

interface CollectionExpectation {
  collection: string;
  requiredFields: string[];
  /** field -> the values this project's code already knows how to handle. Anything else is
   *  flagged as drift — never blocked, this module is purely observational. This is the exact
   *  check that would have caught tokenType "credits" appearing without warning: see
   *  token-types.ts for the incident this guards against. */
  knownValues?: Record<string, string[]>;
}

const EXPECTATIONS: CollectionExpectation[] = [
  {
    collection: "transactions",
    requiredFields: ["user", "model", "tokenType", "rawAmount", "createdAt"],
    knownValues: { tokenType: ["prompt", "completion", "credits"] },
  },
  { collection: "users", requiredFields: ["role"] },
  { collection: "conversations", requiredFields: ["user", "createdAt"] },
  { collection: "agents", requiredFields: ["id", "name"] },
];

async function checkOne(db: Db, exp: CollectionExpectation): Promise<SchemaCheck> {
  try {
    const sample = await db.collection(exp.collection).findOne({});
    if (!sample) {
      return {
        collection: exp.collection,
        ok: true,
        missingFields: [],
        unexpectedValues: {},
        note: "Collection is empty — nothing to check yet.",
      };
    }

    const missingFields = exp.requiredFields.filter((f) => !(f in sample));

    const unexpectedValues: Record<string, string[]> = {};
    for (const [field, known] of Object.entries(exp.knownValues ?? {})) {
      const distinctValues = await db.collection(exp.collection).distinct(field);
      const unexpected = distinctValues.map(String).filter((v) => !known.includes(v));
      if (unexpected.length > 0) unexpectedValues[field] = unexpected;
    }

    const ok = missingFields.length === 0 && Object.keys(unexpectedValues).length === 0;
    return {
      collection: exp.collection,
      ok,
      missingFields,
      unexpectedValues,
      note: ok
        ? "Matches the expected shape."
        : "Schema drift detected against what this codebase's queries assume. Informational only — nothing is blocked, but figures derived from this collection may need a second look.",
    };
  } catch (err) {
    return {
      collection: exp.collection,
      ok: false,
      missingFields: [],
      unexpectedValues: {},
      note: `Could not check this collection: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function checkSchemas(db: Db): Promise<SchemaCheck[]> {
  return Promise.all(EXPECTATIONS.map((exp) => checkOne(db, exp)));
}

// Schema drift is not something that needs sub-minute visibility, and re-running `distinct()`
// on every /status poll (from every open browser tab, every 60s) would add avoidable load for
// no benefit. Cache for a while instead; a real schema change will still surface well within
// a single working session.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; results: SchemaCheck[] } | null = null;

export async function getSchemaChecks(db: Db): Promise<SchemaCheck[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.results;
  const results = await checkSchemas(db);
  cache = { at: now, results };
  return results;
}

// Whether an optional, deployment-specific collection (e.g. a cost-apportioning pipeline this
// project doesn't own) is present at all. A missing optional collection isn't schema drift —
// it's a normal "this feature isn't wired up here" case — so this is a separate, plain boolean
// rather than a SchemaCheck. Cached per name for the same reason getSchemaChecks is cached:
// this gets called on every request to the endpoint that depends on it.
const existsCache = new Map<string, { at: number; value: boolean }>();

export async function collectionExists(db: Db, name: string): Promise<boolean> {
  const now = Date.now();
  const cached = existsCache.get(name);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;
  const found = await db.listCollections({ name }, { nameOnly: true }).toArray();
  const value = found.length > 0;
  existsCache.set(name, { at: now, value });
  return value;
}
