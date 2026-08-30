# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability.

Instead, use GitHub's private vulnerability reporting: go to the
[Security tab](https://github.com/UelingtonSilva/monitor-librechat/security/advisories/new)
of this repository and select "Report a vulnerability". This opens a private advisory
visible only to the maintainers until it's resolved.

Please include:

- What you found and why it's exploitable.
- Steps to reproduce, or a proof of concept if you have one.
- The version/commit you tested against.

## Scope

This project is a **read-only, observational** dashboard: it reads a LibreChat
deployment's MongoDB with a dedicated read-only user and never writes back to it or to
LibreChat itself (see [ADR-002](docs/adr/ADR-002-direct-mongo-reads.md)). The most
relevant kinds of vulnerabilities here are:

- Anything that would let the Monitor's own login/session be bypassed.
- Anything that would let the Monitor's MongoDB user escalate beyond read-only, or that
  would let a Monitor endpoint be used to write to or delete data in the LibreChat
  database.
- Injection in any of the aggregation queries built from user-supplied input (the period
  filters on most endpoints).
- Secrets (Mongo URI, session secret, admin password hash) leaking through logs, error
  responses, or the audit trail.

Out of scope: vulnerabilities that require access to the LibreChat MongoDB instance
itself, or to the underlying host — those are LibreChat's or the deployment's own
security boundary, not this project's.

## Supported versions

This project is pre-1.0 and does not yet maintain parallel release branches. Security
fixes land on the latest commit on `main`; there is no backport policy yet.
