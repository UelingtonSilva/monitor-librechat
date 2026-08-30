# ADR-001 — Separate repository for the Monitor

## Status

Accepted.

## Context

A LibreChat deployment following the upstream project's own convention typically avoids
patching the official `docker-compose.yml` or the pre-built client image. The deployment's
own configuration repository (env templates, `librechat.yaml`, agents, deploy scripts)
stays deliberately thin, on purpose — it holds configuration, not application code.

Most deployments ship a footer notice such as "all content is monitored," but no dashboard
that actually backs that claim: no view into adoption, usage, cost, or MCP audit trails.

## Decision

Build the Monitor as a new, independent repository rather than embedding it inside the
LibreChat deployment's own configuration repository, deployed to the same GitHub
organization and the same cloud project as the LibreChat instance it observes.

## Rationale

- Removes any temptation to patch LibreChat's core or fork it for monitoring purposes.
- Independent lifecycle and deploy: the Monitor can ship without requiring a chat redeploy.
- Smaller access surface: the Monitor only ever needs a **read-only** database user and
  read access to platform logs — never LibreChat's own operational secrets.
- Leaves room for the Monitor to later ingest other sources besides LibreChat, without
  committing to that scope up front.

## Consequences

- Two repositories to maintain, with independent CI/CD pipelines.
- The Monitor cannot intercept or block anything in real time — there is no adapter inside
  LibreChat itself. It is strictly observational in this build. Synchronous enforcement, if
  ever adopted, would need its own ADR and security/governance sign-off.
