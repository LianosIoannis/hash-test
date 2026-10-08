# 07: Deliver the runnable library integration example

**What to build:** A developer can follow documented instructions to run the complete local two-tenant demonstration and integrate both libraries into a consuming Express application through their public interfaces. Read the parent v1 spec before implementation.

**Blocked by:** 05 — Administer session modes and invalidate existing sessions; 06 — Handle central-server failures.

**Status:** ready-for-agent

- [x] Document public backend and browser library interfaces, required configuration, authentication context, error results, and the division between authentication and application business permissions.
- [x] Provide local setup and startup instructions for the central server and separate Express demo server serving its browser UI, including non-destructive migrations and administrator-created fixtures.
- [x] The demo offers email/password sign-in, a protected identity display, and logout for two tenants associated with the same application using different modes.
- [x] The consuming demo integrates through public library interfaces without importing private authentication internals or calling the central database directly.
- [x] Instructions cover sessionStorage persistence, cookie settings and local HTTP exception, two-hour expiry, CSRF requirements, mode-change invalidation, and central-outage behavior.
- [x] Clearly document that v1 requires no application-server credentials and that administration and deployment remain local; deferred features are not presented as implemented.
- [x] Complete HTTP and real-browser verification confirms the integrated journey, tenant isolation, expiry, logout, mode changes, and failures; reuse checks from earlier tickets rather than postponing their testing until this ticket.
- [x] Existing administration regression tests, relevant type checks, and builds pass, with any remaining pre-existing limitations explicitly recorded.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.

**Implementation:** Implemented on 2026-10-08; final review pending.

The user approved .scratch/auth-v1/ticket-07-proposal.md and starting commit
48e54e7d962b18a532d146d8a56d50ba728f7a74. README.md links the complete setup
guide and public library reference. The shared demo host preserves single-
tenant setup and offers links between the combined JWT and COOKIE pages.
The HTTP test starts the actual demo entry point with temporary fixtures;
the browser verifies both mounted journeys and independent logout.

The combined-route test exposed an existing /cookie/ redirect loop. The
redirect now matches only /cookie, permitting the mounted page to load.
Prisma generation, deployment, and status were checked on disposable databases.
Missing SQLite files failed deployment on this Windows setup; a guarded
empty-file creation step succeeded and is documented. No migration or seed
was run against the user's database, and .env remains unchanged.

All 34 HTTP and 12 real-browser tests passed, along with backend/browser-
library/admin-client type checks, both builds, scoped Biome checks and the
100-hash/100-verification Argon2 benchmark. The pre-existing data/auth.db
modification remains separate from source changes.
