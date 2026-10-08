# 01: Establish the baseline

**What to build:** A verified starting point for the v1 authentication integration, preserving existing administration behavior and providing isolated test setup for the central and consuming application servers. Read the parent v1 spec before implementation.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Run the existing administration integration tests, backend and browser type checks, and relevant builds; record outcomes and identify pre-existing failures separately from new changes.
- [x] Provide reusable integration setup that applies migrations to a temporary SQLite database, runs servers on available local ports, and cleans up its own resources.
- [x] Tests never use, reset, or modify the application's database.
- [x] Fixtures support two tenants associated with the same application, administrator-created users and memberships, and the same email address in different tenants.
- [x] Record existing password strategy checks and administration invariants that later tickets must preserve.
- [x] Establish a real-browser verification path for the forthcoming demo without tying tests to private implementation details.
- [x] Keep setup and any necessary prefactoring narrowly scoped; do not introduce unrelated renames or architecture changes.

**Implementation:** Completed on 2026-10-08.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.

Implemented reusable migration/database/server setup, two-tenant HTTP fixtures, and a real-browser Edge smoke path. Final checks: 9 HTTP tests, 1 browser test, both type checks and builds, and the existing Argon2 benchmark passed. See docs/testing-baseline.md for preserved invariants and browser-runner limitations.
