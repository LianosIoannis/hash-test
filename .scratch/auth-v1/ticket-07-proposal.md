# Ticket 07 implementation proposal

Status: Approved, implemented, and reviewed on 2026-10-08.

## Intended result

A developer can follow one guide to run the local central server, administer
two tenants associated with one application, and use the separate Express
demo with JWT at / and COOKIE at /cookie/. The guide also explains integrating
the repository-local backend and browser libraries into another application.

## Documentation and setup

- Add a root README linking to a complete local setup guide and public
  library reference. State the implemented v1 scope and deferred work.
- Document dependency installation, environment configuration, Prisma client
  generation and existing migration deployment. Use non-destructive commands;
  explain migration-history reconciliation for databases created with db push.
  Do not run migrations or seeds against the user's database during this ticket.
- Provision the example through the existing local administration UI: one
  application, two tenants, one tenant application per tenant (JWT/COOKIE),
  tenant-scoped users, memberships, and enabled EMAIL_PASSWORD strategies.
  Do not use the existing seed, which updates existing users' passwords.
- Document exact central/admin/demo startup commands and PowerShell
  environment examples, ports, both demo URLs, cookie origin requirements,
  the explicit loopback HTTP exception, and safe central-only JWT secrets.
- Expand .env.example with the two-tenant demo configuration without editing
  .env. Refresh stale project-plan progress and link existing topic guides.
- Document backend options, router/middleware, browser methods and errors,
  authentication identifiers, and application-owned business permissions.
  Cover sessionStorage, HttpOnly/SameSite/Secure cookies, CSRF, fixed two-hour
  expiry, logout, mode changes, central timeout/outages, and failed logout.
  State that libraries are repository-local, not published npm packages.

## Runnable example and verification

- Share the existing demo mounting logic between its startup entry point and
  tests, preserving the existing single-tenant configuration. Add clear links
  between JWT and COOKIE pages when both tenant applications are configured.
- Keep the demo consuming public library interfaces only, without central
  database or private authentication imports. Central and demo remain loopback.
- Use the already approved HTTP/real-browser seams to verify both mounted
  paths on one separate demo server: sign-in, correct tenant identities,
  navigation, reload persistence, protected access, and logout. Reuse earlier
  regression suites for expiry, isolation, CSRF, mode changes and outages.
- Run all HTTP/browser suites, type checks, builds, formatting and existing
  benchmark. Review documentation examples against actual interfaces and
  verify startup using temporary administrator-created fixtures.
- Perform independent Standards and Spec reviews against starting commit
  48e54e7d962b18a532d146d8a56d50ba728f7a74, then commit scoped changes on
  the current branch and record ticket and v1 completion.

## Scope

No new authentication strategies, migrations, customer-data changes, npm
publishing, production deployment, remote administration or server credentials.
Preserve the existing local data/auth.db modification. Azure client SSO remains
the next proposed authentication milestone, with identity mapping still open.
