# 01: Establish the baseline

**What to build:** A verified starting point for the v1 authentication integration, preserving existing administration behavior and providing isolated test setup for the central and consuming application servers. Read the parent v1 spec before implementation.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Run the existing administration integration tests, backend and browser type checks, and relevant builds; record outcomes and identify pre-existing failures separately from new changes.
- [ ] Provide reusable integration setup that applies migrations to a temporary SQLite database, runs servers on available local ports, and cleans up its own resources.
- [ ] Tests never use, reset, or modify the application's database.
- [ ] Fixtures support two tenants associated with the same application, administrator-created users and memberships, and the same email address in different tenants.
- [ ] Record existing password strategy checks and administration invariants that later tickets must preserve.
- [ ] Establish a real-browser verification path for the forthcoming demo without tying tests to private implementation details.
- [ ] Keep setup and any necessary prefactoring narrowly scoped; do not introduce unrelated renames or architecture changes.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.
