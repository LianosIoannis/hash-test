# 05: Administer session modes and invalidate existing sessions

**What to build:** A local administrator selects one session mode per tenant application, and changing it forces that tenant application's users to sign in again without disrupting others. Read the parent v1 spec before implementation.

**Blocked by:** 03 — Complete session-cookie sign-in and protected access.

**Status:** ready-for-agent

- [x] Expose session-mode viewing and selection through local administration API and UI; accept exactly one supported mode per tenant application.
- [x] Changing the selected mode invalidates every existing session for that tenant application, including JWTs; new sign-ins issue only the newly selected credential.
- [x] Replaying old credentials fails immediately on subsequent central verification; changing back to the original mode does not restore them.
- [x] Sessions for other tenant applications, including another tenant associated with the same application, remain usable.
- [x] Coordinate session issuance and mode changes so concurrent operations cannot leave an old-mode session usable after the change completes.
- [x] Invalid administration requests do not change mode or invalidate sessions; saving the unchanged mode does not count as a mode change.
- [x] Demo and integration checks demonstrate switching in both directions, required reauthentication, unaffected tenants, and concurrency behavior.
- [x] Administration remains local-only; no remote administrator or application-server credential management is introduced.

## Comments

Approved as part of the seven-ticket v1 breakdown. Implementation remains subject to the repository's approval requirement for big changes.

**Implementation:** Implemented and reviewed on 2026-10-08.

The user approved .scratch/auth-v1/ticket-05-proposal.md and the review baseline
716c7456354545f810c4eb9adc0e2e5e18240263. Checks passed: 30 HTTP tests,
8 real-browser tests, backend/browser-library/admin-client type checks, both
builds, scoped Biome checks, and the existing Argon2 benchmark. The browser
suite runs sequentially and uses bounded isolated-process cleanup after
observed Edge startup/shutdown stalls. See docs/session-modes.md.

The concurrent HTTP test reproduced wrong-mode issuance after password
verification; requested-mode validation now occurs inside issuance's
serializable transaction. No schema migration or customer-mode updates were
performed. The existing local data/auth.db modification remains separate.

Final independent reviews against the approved baseline found no outstanding
Standards or Spec findings. The standards review's test-setup duplication
suggestion was addressed by a shared editor helper, then the affected
real-browser test and Biome check passed again. Implementation commit:
05a94de; review cleanup: ff3ab3d. Ticket 05 is complete; ticket 06 is next.
