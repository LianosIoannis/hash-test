# 06: Handle central-server failures

**What to build:** Both library integrations clearly distinguish invalid sessions from central authentication outages and handle failed central logout honestly while clearing local credentials. Read the parent v1 spec before implementation.

**Blocked by:** 04 — Logout in both modes.

**Status:** ready-for-agent

- [ ] Central calls have a documented bounded timeout, with no indefinite waiting or fallback acceptance of a locally checked JWT.
- [ ] Unavailable or timed-out central verification returns 503 without executing the protected handler; invalid or expired sessions return 401.
- [ ] The browser library and demo distinguish temporary service failures from invalid sessions without extending session lifetime or claiming authentication succeeded.
- [ ] If central logout fails, remove the JWT from sessionStorage or clear the application server's authentication cookie and report central logout failure.
- [ ] Failed logout never claims central invalidation succeeded; document that the former central session may remain valid until expiry or successful logout.
- [ ] Cookie-mode logout retains CSRF protection, including during failure handling.
- [ ] Tests use a real central server that can be stopped or made unresponsive to verify both modes' outage and timeout results; browser checks verify local cleanup and failure reporting.
- [ ] Demonstrate that failed central logout can leave the old credential valid after service recovery, and that successful invalidation or expiry prevents its reuse.
- [ ] Successful sign-in, protected access, and logout recover after service availability returns.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.
