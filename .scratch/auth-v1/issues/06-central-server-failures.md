# 06: Handle central-server failures

**What to build:** Both library integrations clearly distinguish invalid sessions from central authentication outages and handle failed central logout honestly while clearing local credentials. Read the parent v1 spec before implementation.

**Blocked by:** 04 — Logout in both modes.

**Status:** ready-for-agent

- [x] Central calls have a documented bounded timeout, with no indefinite waiting or fallback acceptance of a locally checked JWT.
- [x] Unavailable or timed-out central verification returns 503 without executing the protected handler; invalid or expired sessions return 401.
- [x] The browser library and demo distinguish temporary service failures from invalid sessions without extending session lifetime or claiming authentication succeeded.
- [x] If central logout fails, remove the JWT from sessionStorage or clear the application server's authentication cookie and report central logout failure.
- [x] Failed logout never claims central invalidation succeeded; document that the former central session may remain valid until expiry or successful logout.
- [x] Cookie-mode logout retains CSRF protection, including during failure handling.
- [x] Tests use a real central server that can be stopped or made unresponsive to verify both modes' outage and timeout results; browser checks verify local cleanup and failure reporting.
- [x] Demonstrate that failed central logout can leave the old credential valid after service recovery, and that successful invalidation or expiry prevents its reuse.
- [x] Successful sign-in, protected access, and logout recover after service availability returns.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.

**Implementation:** Implemented on 2026-10-08; final review pending.

The user approved .scratch/auth-v1/ticket-06-proposal.md and review baseline
a53ae93b9bd8654a2cd8f73cb14d966ba9cc70c0. The first HTTP and browser tests
exposed generic outage messages; sign-in, protected access, and failed logout
now distinguish central service failures. Existing timeout and local cleanup
behavior is preserved and documented in docs/central-failures.md.

Checks passed: 33 HTTP tests, 11 real-browser tests, backend/browser-library/
admin-client type checks, both builds, and scoped Biome checks. The tests
exercise a real central app against temporary SQLite with connection loss,
503 responses, stalled headers and bodies, blocked mutations, CSRF rejection,
local cleanup, replay after failed logout, successful invalidation, expiry,
and recovery. Browser reload preserves the same session and expiry on 503.
Bounded temporary-directory cleanup retries address an observed transient
Windows profile lock after the isolated browser exited.

No migration or customer-data change was performed. The pre-existing local
data/auth.db modification remains separate.
