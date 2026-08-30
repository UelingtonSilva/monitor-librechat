# ADR-003 — Monitor runs alongside LibreChat's VM, not on a managed container platform

## Status

Accepted. Supersedes an initial deploy decision (a managed container platform) made hours
earlier, before validating against real production data.

## Context

The first publish of the Monitor targeted a managed serverless container platform, still
using synthetic data. Moving to the phase where it reads real data, inspecting the actual
LibreChat host showed that:

- The database container **does not publish a host port** — it is only reachable over the
  deployment's own internal Docker network.
- The only container publishing a public port is the reverse proxy (typically Caddy, on
  80/443). Any admin panel is bound to `127.0.0.1` and reached only through an IAP-style
  tunnel.

For a managed serverless platform to reach the database, the deployment would need to
expose the database port on the VM's internal network, add direct VPC egress, and a
matching firewall rule — publishing on the network the exact port that holds every
corporate conversation.

## Decision

Run the Monitor as a container on the same VM as the LibreChat deployment, on its internal
Docker network, bound to `127.0.0.1` with access through an IAP-style tunnel — the same
pattern already used for the admin panel. The managed-platform deployment was decommissioned.

## Rationale

- Opens no new port: the network surface of the environment stays identical to before.
- Matches the deployment's own convention: no public port besides the reverse proxy;
  internal services reachable only on the internal network, administrative access via tunnel.
- Removes the need for a VPC connector and a new firewall rule — fewer moving parts to
  maintain and audit.
- Shortens the path to the data: the Monitor reads the database over the internal network,
  never crossing a VPC boundary.

## Consequences

- The Monitor shares the VM's lifecycle: if the VM goes down, so does the portal. Acceptable
  for an observability tool that is not on the chat's critical path.
- No autoscaling. Irrelevant at the scale this project targets and for on-demand queries.
- Access requires an SSH tunnel with port forwarding rather than a direct URL — more friction
  for an end user. Resolving that is exactly what a future authentication phase should
  address before opening the portal to non-technical stakeholders.
- The image is still built and published by the same CI pipeline; only where it runs changes.
