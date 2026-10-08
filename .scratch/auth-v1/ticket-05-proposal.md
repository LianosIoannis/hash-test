# Ticket 05 implementation proposal

Status: Approved by the user on 2026-10-08; implementation in progress.

## Intended result

Local administration can view and select JWT or COOKIE for each tenant
application. Changing that selection permanently invalidates its existing
sessions. Other tenant applications remain signed in, including those for
the same application in another tenant.

## Administration API and UI

- Reuse the existing sessionStrategy column; no schema migration is needed.
- Extend tenant-application creation with an optional JWT/COOKIE selection,
  retaining JWT as the default for existing callers.
- Extend the existing PATCH endpoint with optional key and sessionStrategy
  fields, requiring at least one valid field and exactly one supported mode.
  Preserve existing key-only edits.
- Display the selected mode in the tenant-applications table and add a mode
  selector to creation/edit forms. Explain that changing it signs out all
  users of that tenant application.
- Validate before writing. Failed requests roll back completely. Saving the
  current mode preserves sessions.

## Invalidation and concurrent sign-in

- Change the selected mode and delete all sessions belonging to its
  memberships in one database transaction, including JWT, COOKIE, expired,
  and legacy session rows. Delete sessions only when the mode changes.
- Coordinate this transaction with session issuance through database
  transaction ordering, rather than relying on a process-local lock.
- Check the requested integration mode against the current selected mode
  within the issuance transaction. The existing route-level check alone
  must not authorize issuance after the configuration changes.
- Handle transaction contention without accepting stale credentials; if a
  retry is needed, read configuration again in a fresh transaction.
- Switching back cannot restore deleted sessions. Subsequent requests remain
  centrally verified and denied for the former credentials.

## Integration and verification

- Keep each consuming route/browser client explicitly configured for one
  mode. Document updating the consuming integration to the newly selected
  mode before signing in again; do not introduce automatic mode fallback.
- Replace disposable test-fixture mode setup with the public administration
  API where appropriate. Do not change real customer records or modes as
  part of implementation or test setup.
- Use the already approved HTTP and real-browser boundaries to check both
  switch directions, old-credential replay after switching back, successful
  reauthentication, unaffected tenants, invalid and unchanged-mode saves,
  and overlapping sign-ins/mode changes through real servers and SQLite.
- Verify the actual admin UI selector and browser access behavior, then run
  existing administration, JWT, COOKIE, logout, type, build, and formatting
  checks.
- Review against starting commit
  `716c7456354545f810c4eb9adc0e2e5e18240263` and commit scoped source changes
  on the current branch. Preserve the pre-existing local data/auth.db change.

## Scope

Administration remains bound to loopback with its existing local workflow.
No remote administrator authentication, server credentials, SSO, refresh
tokens, or deployment changes are introduced. Complete outage UX remains
ticket 06, and final runnable-example packaging remains ticket 07.
