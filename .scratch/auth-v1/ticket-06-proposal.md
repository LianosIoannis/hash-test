# Ticket 06 implementation proposal

Status: Approved by the user on 2026-10-08; implementation in progress.

## Intended result

Both JWT and COOKIE integrations distinguish invalid sessions from temporary
central authentication failures. Protected handlers never run during failed
verification. Failed central logout clears local credentials and explicitly
reports that central invalidation was not confirmed.

## Library and demo behavior

- Retain the backend's configurable central timeout, defaulting to 5,000 ms,
  and document its scope across sign-in, verification, and logout. Verify
  bounded handling of stalled response bodies as well as stalled connections.
- Preserve 401 for invalid or expired sessions and 503 for unavailable,
  timed-out, or unusable central responses. Do not accept JWTs locally, cache
  authentication, automatically retry operations, or renew sessions.
- Give browser sign-in failures and demo protected-access failures clear
  temporary-service messages distinct from invalid-session messages. Keep
  valid credentials on verification 503 so recovery can resume the same
  unexpired session; continue clearing JWT storage on 401.
- Preserve JWT logout cleanup in finally and application-server cookie
  cleanup for CSRF-authorized logout, including central failure. Report that
  central invalidation was not confirmed and the former session may remain
  usable until expiry or successful central logout.
- Keep cookie logout CSRF validation before any cleanup or central action.
  A rejected CSRF request must preserve the credential and session.

## Verification

Use the already approved public HTTP/browser seams with the real central
application and temporary SQLite database. Add fixture controls to stop and
restore central availability and make central requests unresponsive, without
replacing authentication or database logic with mocks.

Work one observable behavior at a time through TDD:

- Both modes return 503 within the configured bound during outage/timeout;
  protected handlers do not execute and invalid/expired sessions remain 401.
- Browser reload and protected requests distinguish outages from invalid
  sessions without discarding valid credentials or extending their expiry.
- Failed logout clears sessionStorage or the application's auth cookie and
  reports failure. Cookie-mode CSRF rejection still prevents cleanup.
- After recovery, replay demonstrates that failed central logout can leave
  the old session valid; successful logout or expiry prevents reuse.
- Successful sign-in, protected access, and logout recover in both modes.

Run the complete HTTP/browser regression suites, relevant type checks,
builds, formatting, and existing benchmark. Perform independent Standards
and Spec reviews against starting commit
`a53ae93b9bd8654a2cd8f73cb14d966ba9cc70c0`, then commit scoped changes on the
current branch and record completion in the local ticket.

## Scope

No schema migration, real customer-data changes, remote administration,
retry framework, offline acceptance, or ticket 07 packaging. Preserve the
pre-existing local data/auth.db modification.
