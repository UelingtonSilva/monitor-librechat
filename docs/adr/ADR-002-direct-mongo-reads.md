# ADR-002 — Read MongoDB directly; no event pipeline in the first build

## Status

Accepted.

## Context

The original governance blueprint behind this project describes a full architecture with
an event bus as the backbone, a relational store for operational data, and a data warehouse
(raw/curated/gold layers) for analytics, plus a synchronous inline policy gate, a policy
engine, DLP, and a classification engine.

A typical small-to-mid deployment this project targets serves on the order of tens of
users, runs on a single VM via Docker Compose (not a managed container platform), and keeps
all application state in one MongoDB database — LibreChat's own. There is usually no
existing analytics API or usage dashboard; the deployment's admin panel, where one exists,
is configuration management only.

## Decision

For the first delivery (telemetry phase), `monitor-api` reads the relevant MongoDB
collections directly (`transactions`, `balances`, `users`, `conversations`/`messages` for
metadata and counts only, `agents`, `aclentries`, `roles`, `configs`) through a dedicated
**read-only** database user, and reads platform logs for MCP-proxy audit entries. No event
bus, additional relational store, or data warehouse is introduced at this stage.

## Rationale

- At this scale, the operational complexity of an asynchronous event pipeline is not
  justified — direct reads are enough to power adoption, usage, and cost dashboards.
- Fewer new cloud resources to provision and fewer secrets to manage at the outset.
- Keeps the architecture easy to audit: any figure shown in the portal traces back to a
  single query against the database, with no intermediate event layer to reason about.

## Consequences

- No time-series history beyond what the database itself retains. If longer retention of
  trends is needed later, that becomes the trigger to reopen this ADR and introduce a data
  warehouse.
- No event replay or dead-letter queue — a read failure is handled as an ordinary API error,
  not as a lost event, because there is no "event" at this stage, only on-demand queries.
- This decision is revisitable: if usage grows substantially, or other AI applications need
  to feed the same portal, the original event-driven model becomes the reference again.
