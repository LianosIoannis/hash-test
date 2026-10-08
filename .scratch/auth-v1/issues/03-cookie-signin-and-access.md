# 03: Complete session-cookie sign-in and protected access

**What to build:** The second tenant of the same demo application can sign in with email and password using a session cookie, reload the browser, and access a protected endpoint through both libraries. Read the parent v1 spec before implementation.

**Blocked by:** 02 — Complete JWT sign-in and protected access.

**Status:** ready-for-agent

- [ ] Configure the second demo tenant application for cookie mode while retaining JWT mode for the first; each uses exactly one mode.
- [ ] The central server issues an opaque session token and stores its hash; the application server sets its own HttpOnly, SameSite=Lax authentication cookie without exposing the raw token in browser-readable response bodies.
- [ ] Require Secure under HTTPS with an explicit local HTTP development exception; cookie-mode authentication does not depend on a shared cross-domain cookie.
- [ ] The browser library and backend integration support same-origin cookie authentication, protected requests, reload persistence, and fixed two-hour expiry without renewal.
- [ ] Central verification binds the cookie session to its membership and intended tenant application on every request; wrong-mode credentials cannot provide fallback access.
- [ ] Cookie-mode sign-in and state-changing protected requests have CSRF protection; verify rejected requests have no state-changing effect. Apply the same protection to logout when introduced in ticket 04.
- [ ] Real-browser checks verify cookie delivery and attributes, reload behavior, and CSRF enforcement; integration checks verify expiry, wrong-mode rejection, tenant isolation, and no credential leakage.
- [ ] JWT-mode behavior and existing administration tests remain passing.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.
