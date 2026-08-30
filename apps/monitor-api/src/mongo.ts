import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";

let client: MongoClient | null = null;
let db: Db | null = null;
let lastError: string | null = null;
let lastFailureAt: number | null = null;

// If Mongo is unreachable, every request that calls getMongoDb() would otherwise attempt a
// fresh connection (each with its own driver-level connection timeout) — under normal polling
// load that means several stacked slow attempts per minute instead of one. This backoff makes
// a recent failure return null immediately, so the caller's existing synthetic-data fallback
// kicks in fast instead of every request hanging.
const RETRY_BACKOFF_MS = 10_000;

/** Pure timing check, independent of module state, so the backoff window itself is testable
 *  without needing a real (or faked) MongoClient connection attempt. */
export function isWithinBackoffWindow(
  lastFailureAt: number | null,
  now: number,
  windowMs = RETRY_BACKOFF_MS
): boolean {
  return lastFailureAt !== null && now - lastFailureAt < windowMs;
}

export async function getMongoDb(): Promise<Db | null> {
  if (!env.mongoUri) return null;
  if (db) return db;
  if (isWithinBackoffWindow(lastFailureAt, Date.now())) return null;

  try {
    client = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 5_000 });
    await client.connect();
    db = client.db(env.mongoDb);
    lastError = null;
    lastFailureAt = null;
    return db;
  } catch (err) {
    await client?.close().catch(() => {});
    client = null;
    db = null;
    lastError = err instanceof Error ? err.message : String(err);
    lastFailureAt = Date.now();
    return null;
  }
}

/** Sanitized reason for the last connection failure, for status reporting — never the URI. */
export function getLastMongoError(): string | null {
  return lastError;
}

export function isMongoConfigured(): boolean {
  return env.mongoUri !== null;
}

export async function closeMongo(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
