# 07: Deliver the runnable library integration example

**What to build:** A developer can follow documented instructions to run the complete local two-tenant demonstration and integrate both libraries into a consuming Express application through their public interfaces. Read the parent v1 spec before implementation.

**Blocked by:** 05 — Administer session modes and invalidate existing sessions; 06 — Handle central-server failures.

**Status:** ready-for-agent

- [ ] Document public backend and browser library interfaces, required configuration, authentication context, error results, and the division between authentication and application business permissions.
- [ ] Provide local setup and startup instructions for the central server and separate Express demo server serving its browser UI, including non-destructive migrations and administrator-created fixtures.
- [ ] The demo offers email/password sign-in, a protected identity display, and logout for two tenants associated with the same application using different modes.
- [ ] The consuming demo integrates through public library interfaces without importing private authentication internals or calling the central database directly.
- [ ] Instructions cover sessionStorage persistence, cookie settings and local HTTP exception, two-hour expiry, CSRF requirements, mode-change invalidation, and central-outage behavior.
- [ ] Clearly document that v1 requires no application-server credentials and that administration and deployment remain local; deferred features are not presented as implemented.
- [ ] Complete HTTP and real-browser verification confirms the integrated journey, tenant isolation, expiry, logout, mode changes, and failures; reuse checks from earlier tickets rather than postponing their testing until this ticket.
- [ ] Existing administration regression tests, relevant type checks, and builds pass, with any remaining pre-existing limitations explicitly recorded.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.
