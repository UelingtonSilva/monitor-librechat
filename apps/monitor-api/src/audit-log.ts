import type { AuditEntry } from "@monitor-librechat/shared";

// In-memory buffer recording access to this API: who queried what. It is lost on restart.
// Durable storage belongs with the role-based access work, not before it — persisting an
// audit trail that nobody is authenticated against would record little of value.
const MAX_ENTRIES = 500;
const entries: AuditEntry[] = [];

export function recordAudit(entry: AuditEntry): void {
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
}

export function getAuditEntries(): AuditEntry[] {
  return entries;
}
