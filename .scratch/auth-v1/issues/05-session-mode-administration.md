# 05: Administer session modes and invalidate existing sessions

**What to build:** A local administrator selects one session mode per tenant application, and changing it forces that tenant application's users to sign in again without disrupting others. Read the parent v1 spec before implementation.

**Blocked by:** 03 — Complete session-cookie sign-in and protected access.

**Status:** ready-for-agent

- [ ] Expose session-mode viewing and selection through local administration API and UI; accept exactly one supported mode per tenant application.
- [ ] Changing the selected mode invalidates every existing session for that tenant application, including JWTs; new sign-ins issue only the newly selected credential.
- [ ] Replaying old credentials fails immediately on subsequent central verification; changing back to the original mode does not restore them.
- [ ] Sessions for other tenant applications, including another tenant associated with the same application, remain usable.
- [ ] Coordinate session issuance and mode changes so concurrent operations cannot leave an old-mode session usable after the change completes.
- [ ] Invalid administration requests do not change mode or invalidate sessions; saving the unchanged mode does not count as a mode change.
- [ ] Demo and integration checks demonstrate switching in both directions, required reauthentication, unaffected tenants, and concurrency behavior.
- [ ] Administration remains local-only; no remote administrator or application-server credential management is introduced.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.
