# 04: Logout in both modes

**What to build:** A signed-in demo user can log out through the browser library in either mode, invalidating the current central session and removing its local credential. Read the parent v1 spec before implementation.

**Blocked by:** 03 — Complete session-cookie sign-in and protected access.

**Status:** ready-for-agent

- [x] Implement current-session logout through the browser library, application-server integration, central server, and demo UI for both modes.
- [x] Successful JWT logout removes the stored JWT; successful cookie logout clears the authentication cookie through the application server.
- [x] Central logout invalidates the current session only; other sessions and tenant applications remain unaffected.
- [x] Replaying the former JWT or opaque cookie credential after successful logout is denied with 401, including after browser reload.
- [x] Cookie logout enforces CSRF protection; rejected logout requests do not invalidate the session or clear its cookie.
- [x] The protected endpoint no longer accepts the logged-out browser; signing in again creates a usable new session.
- [x] Integration and browser checks verify local cleanup and actual central invalidation rather than relying solely on the demo's signed-out display.
- [x] Preserve both modes' sign-in and expiry behavior; full central-failure logout behavior follows in ticket 06.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.

**Implementation:** Completed and reviewed on 2026-10-08.

The user explicitly approved ticket 04. Verification passed: 26 HTTP tests,
7 real-browser tests including Secure-cookie deletion under HTTPS, backend,
browser-library and admin-client type checks, both builds, scoped Biome checks,
and the existing Argon2 benchmark. See docs/logout.md. No migration is needed;
the pre-existing local application database change is excluded from commits.

Review baseline approved by the user: 7dbd17a9bc6ebe6454f52e814ad421eba8529d6c.

Implementation commit: `60ee187`. Standards review identified duplicated
test fixture setup; extracted it in `9faf65e`, then all 8 affected HTTP and
browser tests passed again. Final Standards review: 0 outstanding findings.
Spec review: 0 findings. Ticket 05 is the next unblocked implementation slice.
