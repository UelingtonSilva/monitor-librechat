# Contributing

Thanks for considering a contribution. This project is small and pre-1.0, so keep changes
proportionate — a small, well-tested fix is easier to review and merge than a large one.

## Development setup

Prerequisites: Node.js 20+ (see `.nvmrc`), and optionally read access to a LibreChat
MongoDB (production, staging, or a local copy with synthetic data) — everything runs
without one, falling back to clearly-marked synthetic data.

```bash
npm install
npm run build -w packages/shared  # both apps import this workspace package by its build output

# API (port 4000 by default)
cp apps/monitor-api/.env.template apps/monitor-api/.env
npm run hash-password -w apps/monitor-api -- "choose-a-password"  # paste into ADMIN_PASSWORD_HASH in .env
npm run dev -w apps/monitor-api

# Portal (port 5173 by default) — needs no .env of its own; dev proxies API calls to port 4000
npm run dev -w apps/monitor-portal
```

Before opening a PR:

```bash
npm run build   # all three workspaces (packages/shared, monitor-api, monitor-portal)
npm test        # vitest across every workspace that has tests
npm run lint    # eslint
npx prettier --check .
```

CI runs the same four commands; there is no separate "CI-only" check to guess at.

## Code style

- **English** for all code, identifiers, and comments. User-facing UI text is the one
  exception — it goes through i18n (see below), not hardcoded strings.
- **Comments explain why, not what.** A well-named variable already says what it does;
  a comment is for a non-obvious constraint, an incident that shaped the code, or a
  decision a future reader would otherwise second-guess. If you're about to write a
  comment that just restates the line below it, skip it.
- Formatting is enforced by Prettier, not by hand — run `npx prettier --write .` rather
  than manually matching style.

## Adding or changing UI text (i18n)

Text shown in the portal comes from `apps/monitor-portal/src/locales/<lng>/<namespace>.json`.
The config auto-discovers every `locales/*/*.json` file — adding a new namespace is just
adding the two JSON files (`en` and `pt-BR`), nothing to register elsewhere.

**Both languages are required.** `apps/monitor-portal/src/locales/keys.test.ts` fails CI
if `en` and `pt-BR` don't define exactly the same set of keys for every namespace — a PR
that adds an English string without its Portuguese counterpart (or vice versa) won't pass.

Don't put backend/API-supplied values (role names, model names, policy IDs, dates before
formatting) through i18n — only hardcoded page chrome (headings, labels, column headers,
button text) is translatable content. See any existing page component for the pattern.

## Tests

- API tests live next to the code they test (`*.test.ts` in `apps/monitor-api/src`), run
  with `vitest`.
- A bug fix should come with a regression test where practical — see
  `mongo-fields.test.ts` and `schema-guard.test.ts` for the pattern this project uses:
  guard against the exact failure mode that happened, not a generic "it works" test.
- The portal's test suite currently only covers the i18n key-parity check; UI behavior is
  verified manually (build + run + click through) rather than with component tests. If
  you add meaningful interactive logic, a test is welcome but not required by CI today.

## Commit messages and PRs

- Describe _why_ a change was made, not just what changed — the diff already shows the
  what.
- Keep unrelated changes out of the same commit/PR (a formatting pass and a bug fix are
  two PRs, not one) so each is reviewable on its own.
- Use the PR template's checklist — it exists because the two things it checks
  (i18n key parity, no leaked secrets) have both actually happened during this project's
  history.

## Architecture decisions

Significant, hard-to-reverse decisions (why a separate repo, why direct MongoDB reads
instead of an event pipeline, why the deployment example runs on a VM) are recorded in
`docs/adr/`. If your change reopens one of those decisions, update or add an ADR rather
than only changing code — the reasoning is the part that's easy to lose.
