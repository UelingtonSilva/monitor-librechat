# Monitor LibreChat

A monitoring and audit portal for a self-hosted [LibreChat](https://github.com/danny-avila/LibreChat)
deployment — adoption, usage, cost, and a shadow-mode security detector, in one dashboard.

> **Not affiliated with LibreChat.** This is an independent, third-party project. It is not
> affiliated with, endorsed by, or sponsored by the LibreChat project or its maintainers.

[MIT licensed](LICENSE) · [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security policy](SECURITY.md)

Covers a common gap: LibreChat deployments often ship a footer notice saying "all content
is monitored," but no dashboard that actually backs that claim — nothing showing adoption,
usage, cost, or MCP audit trails.

Independent from the LibreChat deployment's own configuration repository — see
[ADR-001](docs/adr/ADR-001-separate-repository.md). Reads the LibreChat MongoDB directly
(no event pipeline or data warehouse in this build) — see
[ADR-002](docs/adr/ADR-002-direct-mongo-reads.md).

## Structure

```
apps/monitor-api/       API (Fastify + TypeScript) — reads Mongo read-only + platform logs
apps/monitor-portal/    Portal (React + Vite + TypeScript + Tailwind) — dashboards, EN/pt-BR
packages/shared/        TypeScript types shared between the API and the portal
policies/               Detection policy catalog + MCP integrations config (YAML), versioned in Git
docs/adr/               Architecture Decision Records
```

## What's implemented today

The portal covers 12 screens. What each one actually delivers, versus what's still
documented-but-not-built:

| Screen               | State                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Executive Dashboard  | Real data — cards, trend, adoption, usage, risk, Agents                                                                                      |
| Adoption             | Real data — DAU/WAU/MAU, activation rate, 30-day series, breakdown by role                                                                   |
| Costs                | Real data — verified cost via an optional aggregate collection if configured, otherwise a token-times-price estimate, by role/model/area/day |
| Use Cases            | Partial — volume and Agent used as a proxy; purpose classification needs a later phase                                                       |
| Maturity             | Documentational — criteria and levels defined; the score itself isn't computed                                                               |
| Security & Risk      | Real data — deterministic detection running in shadow mode                                                                                   |
| Alerts / Cases       | Real data, read-only — a case-management workflow needs a later phase                                                                        |
| Policies             | Real data — a versioned policy catalog in `policies/*.yaml`                                                                                  |
| Authorized Resources | Real data — model allowlist by role, Agents, MCP integrations                                                                                |
| Audit Trail          | Real data — access to the Monitor itself + MCP queries via platform logs                                                                     |
| Settings             | Documentational — target parameters and RBAC design; the Monitor has no auth of its own beyond a single shared login                         |
| Operational Status   | Real data — health, SLOs, and a schema-drift check against the collections this project reads                                                |

**Security detection runs in shadow mode.** Five policies actually run, all local
deterministic regex (no message content is ever sent to an LLM, and nothing is
persisted): credential/API-key exposure, explicit password/token, private-key material,
national-ID patterns, and model usage outside a role's allowlist. The rest of the
catalog is registered for traceability but produces no detections yet — they depend on
semantic classification or a synchronous inline check, neither of which this build has.

**The Monitor blocks nothing.** There is no prompt interception — it reads the database
after the fact. No policy is in enforcement, and enforcement would require an adapter
inside LibreChat itself, which is a decision that needs its own ADR and sign-off from
whoever owns security/governance for the deployment.

## Running locally

Prerequisites: Node.js 20+ (see `.nvmrc`), and optionally read access to a LibreChat
MongoDB (production, staging, or a local copy with synthetic data).

```bash
npm install

# monitor-api (port 4000 by default)
cp apps/monitor-api/.env.template apps/monitor-api/.env
npm run dev -w apps/monitor-api

# monitor-portal (port 5173 by default)
npm run dev -w apps/monitor-portal
```

Without `MONGO_URI` set, the API still starts normally and every analytics endpoint
returns clearly-marked example data (`"synthetic": true`), so the portal can be developed
without needing access to a production LibreChat instance.

## MongoDB access

The Monitor should read the database through a dedicated **read-only** user (`read` on
the `LibreChat` database), with its connection string kept in a secrets manager — never
hardcoded. That guarantee needs to be real, not just convention: confirm LibreChat's
MongoDB is actually running with `--auth` enabled before creating this user — without
that, any container on the same Docker network has unrestricted read/write access to
every conversation.

## Adapting to your deployment

The core dashboards (adoption, usage, security detection, audit trail) read only from
LibreChat's own MongoDB schema (`users`, `transactions`, `conversations`, `agents`,
`configs`) and work for any LibreChat deployment out of the box — roles, for instance, are
whatever strings your deployment's `users.role` field actually contains, not a fixed list.

A few things are **optional integrations**, off by default, that only turn on if you
configure them. The Operational Status screen has a dedicated "Optional integrations"
panel that reports exactly which of these are active and why, so you don't have to guess:

- **Cost pipeline.** Without `COST_COLLECTION_NAME`, Costs shows an estimate computed from
  token counts times a placeholder price table (`apps/monitor-api/src/pricing.ts`) — real
  numbers, approximate pricing. If your deployment already apportions LibreChat usage into a
  verified USD cost some other way, point `COST_COLLECTION_NAME` at that collection (see the
  env template for the expected shape) to use it instead.
- **MCP audit.** Requires both `GOOGLE_CLOUD_PROJECT` and `MCP_AUDIT_SERVICE_NAMES` (the
  Cloud Logging service names of your own MCP proxies). Without both, that section of Audit
  Trail uses synthetic data.
- **MCP integrations catalog.** Which MCP tools exist and which roles may use them lives in
  `policies/mcp-integrations.yaml`, not in code — ships with a placeholder entry; replace it
  with your own deployment's integrations and roles.

None of these require forking or rebuilding the project — they're config, not code.

## Deployment example

The example below assumes GCP (Compute Engine + IAP), but the idea is generic: run as a
container on the same VM/host as LibreChat, on the same Docker network as the database
— see [ADR-003](docs/adr/ADR-003-runs-on-the-vm.md). Bind to `127.0.0.1:3100`, no new
port exposed — the same pattern as any other internal admin tool.

Access via an IAP tunnel (GCP):

```bash
gcloud compute ssh your-librechat-vm --zone=your-zone --project=your-gcp-project --tunnel-through-iap -- -N -L 3100:127.0.0.1:3100
```

The portal is then reachable at `http://localhost:3100`.

Updating the deployed version:

```bash
gcloud builds submit --config=cloudbuild.yaml --substitutions=_TAG=vX.Y.Z,_REGION=your-region,_PROJECT=your-gcp-project --project=your-gcp-project
```

Then, on the VM: update `MONITOR_TAG` in `/opt/monitor-librechat/.env` and run
`docker compose up -d` in that directory.

## Deploy architecture — single service

The API and the portal ship as **one container** (root-level `Dockerfile`): the API
serves the portal's built static files from the same origin, so the browser calls
`/api/v1/*` with no CORS involved.

### Deploy gotchas

- **Don't pass POSIX paths in environment variables through Git Bash on Windows.** MSYS
  silently rewrites `/app/policies` into `C:/Program Files/Git/app/policies`, and the
  service comes up unable to find its files. `POLICIES_DIR` and `PORTAL_DIR` are already
  set in the Dockerfile — don't override them from a Windows shell.
- **`.sh` scripts need LF line endings.** CRLF breaks the shebang once the script reaches
  a Linux host (`/usr/bin/env: 'bash\r'`). `.gitattributes` normalizes this repo-wide, but
  a script authored outside Git can still slip through.
- **Don't use `gcloud builds submit --tag`** for this image: the root `cloudbuild.yaml` is
  what assembles the multi-stage build with the portal bundled in.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, code style, and the
i18n key-parity rule that CI enforces. Please also read the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues should go through the private
process in [SECURITY.md](SECURITY.md), not a public issue.

## Acknowledgments

**Uelington Silva** — creator and project lead.
Supported by **Dimep Sistemas**.

## License

[MIT](LICENSE).
