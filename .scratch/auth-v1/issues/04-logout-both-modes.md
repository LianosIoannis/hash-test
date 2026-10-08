# 04: Logout in both modes

**What to build:** A signed-in demo user can log out through the browser library in either mode, invalidating the current central session and removing its local credential. Read the parent v1 spec before implementation.

**Blocked by:** 03 — Complete session-cookie sign-in and protected access.

**Status:** ready-for-agent

- [ ] Implement current-session logout through the browser library, application-server integration, central server, and demo UI for both modes.
- [ ] Successful JWT logout removes the stored JWT; successful cookie logout clears the authentication cookie through the application server.
- [ ] Central logout invalidates the current session only; other sessions and tenant applications remain unaffected.
- [ ] Replaying the former JWT or opaque cookie credential after successful logout is denied with 401, including after browser reload.
- [ ] Cookie logout enforces CSRF protection; rejected logout requests do not invalidate the session or clear its cookie.
- [ ] The protected endpoint no longer accepts the logged-out browser; signing in again creates a usable new session.
- [ ] Integration and browser checks verify local cleanup and actual central invalidation rather than relying solely on the demo's signed-out display.
- [ ] Preserve both modes' sign-in and expiry behavior; full central-failure logout behavior follows in ticket 06.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.
