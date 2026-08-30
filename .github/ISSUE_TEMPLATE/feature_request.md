---
name: Feature request
about: Propose something the Monitor doesn't do yet
labels: enhancement
---

**What problem does this solve**
What are you trying to see or do that the current dashboards/API don't cover?

**Proposed approach**
If you have one in mind. Not required — describing the problem is enough.

**Scope check**
This project is deliberately observational (see
[ADR-001](../../docs/adr/ADR-001-separate-repository.md) and
[ADR-002](../../docs/adr/ADR-002-direct-mongo-reads.md)): it reads LibreChat's MongoDB
directly, it doesn't intercept or block anything, and it doesn't add new infrastructure
(event bus, data warehouse) unless the existing read-only approach genuinely stops being
enough. If your request needs one of those, say so explicitly — it's still worth filing,
it just means the discussion starts with "does this change the architecture" first.
