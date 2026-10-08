# 02: Complete JWT sign-in and protected access

**What to build:** An existing tenant user can sign in with email and password through the browser library, reload the tab, and access an Express demo endpoint protected by the backend library using a centrally verified JWT. Read the parent v1 spec before implementation.

**Blocked by:** 01 — Establish the baseline.

**Status:** ready-for-agent

- [x] Provide usable TypeScript backend and framework-independent browser library interfaces for this journey, with a local central server and a separate Express demo server serving its browser UI.
- [x] Browser authentication calls use same-origin demo endpoints; the demo server forwards authentication operations centrally without application-server credentials or allowlists.
- [x] Add the required session-mode and centrally verifiable session persistence through migrations that preserve existing domain records; document backfill defaults and explicit legacy-session behavior without resetting the database.
- [x] Email/password sign-in checks tenant-scoped credentials, membership, and the exact enabled authentication strategy; invalid credentials, missing membership, and disabled strategy do not create a session.
- [x] JWT-mode sign-in issues only the selected credential, bound to a central session and membership; the browser stores it in sessionStorage and sends it in the Authorization bearer header.
- [x] A browser reload retains access within the tab without extending the fixed two-hour expiry.
- [x] Middleware verifies every protected request centrally without acceptance caching, checking JWT validity, central session validity, configured mode, and the intended tenant application supplied by the consuming server's route context.
- [x] Successful authentication exposes user ID, tenant ID, tenant application ID, membership ID, and session ID; application business permissions remain outside the library.
- [x] Invalid, tampered, expired, or wrong-tenant-application credentials are rejected with 401 and never reach the protected handler. A central outage denies access with 503; full timeout and failure UX coverage follows in ticket 06.
- [x] Tests cover the successful browser journey, reload persistence, two-hour expiry without waiting two hours, rejected sign-ins, same-email tenant isolation, and centrally invalidated JWT denial.
- [x] Preserve existing username/password behavior and administration invariants where compatible with the declared v1 session contract; relevant checks pass.

**Implementation:** Completed on 2026-10-08; final code review pending.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.

Approved proposal implemented. Final checks: 16 HTTP tests, 2 real-browser tests, backend/browser-library/admin-client type checks, both builds, and the existing Argon2 benchmark passed. Application database migrations were not applied. See docs/jwt-integration.md for public interfaces, setup, and legacy-session compatibility.
