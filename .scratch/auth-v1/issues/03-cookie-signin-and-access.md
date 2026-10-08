# 03: Complete session-cookie sign-in and protected access

**What to build:** The second tenant of the same demo application can sign in with email and password using a session cookie, reload the browser, and access a protected endpoint through both libraries. Read the parent v1 spec before implementation.

**Blocked by:** 02 — Complete JWT sign-in and protected access.

**Status:** ready-for-agent

- [x] Configure the second demo tenant application for cookie mode while retaining JWT mode for the first; each uses exactly one mode.
- [x] The central server issues an opaque session token and stores its hash; the application server sets its own HttpOnly, SameSite=Lax authentication cookie without exposing the raw token in browser-readable response bodies.
- [x] Require Secure under HTTPS with an explicit local HTTP development exception; cookie-mode authentication does not depend on a shared cross-domain cookie.
- [x] The browser library and backend integration support same-origin cookie authentication, protected requests, reload persistence, and fixed two-hour expiry without renewal.
- [x] Central verification binds the cookie session to its membership and intended tenant application on every request; wrong-mode credentials cannot provide fallback access.
- [x] Cookie-mode sign-in and state-changing protected requests have CSRF protection; verify rejected requests have no state-changing effect. Apply the same protection to logout when introduced in ticket 04.
- [x] Real-browser checks verify cookie delivery and attributes, reload behavior, and CSRF enforcement; integration checks verify expiry, wrong-mode rejection, tenant isolation, and no credential leakage.
- [x] JWT-mode behavior and existing administration tests remain passing.

**Implementation:** Completed and reviewed on 2026-10-08.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.

The user approved `.scratch/auth-v1/ticket-03-proposal.md`. Checks passed:
21 HTTP tests, 4 real-browser tests including HTTPS Secure cookie delivery,
backend/browser-library/admin-client type checks, both builds, scoped Biome
checks, and the existing Argon2 benchmark. Concurrent CSRF requests were
verified after fixing bootstrap token rotation. See docs/cookie-integration.md.

The application database was upgraded separately at the user's request with
a consistent backup and record-preservation checks. Its local modification
and ignored backup are excluded from source commits.

Reviewed against `e4e73a14c2d6411d3f39003379e482c3a591a259`.
Standards review identified duplicated persistence between modes; fixed in
`23a9573`, with backend type checking and all 21 HTTP tests passing again.
Final Standards review: 0 outstanding findings. Spec review: 0 findings.
Implementation commit: `a69fb43`.
