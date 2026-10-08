# Session-mode administration

Ticket 05 lets a local administrator select JWT or COOKIE for each tenant
application. In **Tenant apps**, the table shows the selected mode. Creation
and edit forms provide a **Session mode** selector, and edits explain that a
mode change signs out all users of that tenant application.

## API

POST `/api/tenant-applications` accepts optional `sessionStrategy: "JWT" |
"COOKIE"`. Omitting it preserves the JWT creation default.

PATCH `/api/tenant-applications/:id` accepts `sessionStrategy`, `key`, or both:

```json
{ "sessionStrategy": "COOKIE" }
```

At least one valid field is required. Unsupported modes, arrays, null, and
invalid keys are rejected. Existing key-only updates continue to work.
Saving the current mode leaves sessions valid. Validation errors and failed
writes, including duplicate-key conflicts, do not change mode or delete
sessions. Administration keeps its existing loopback-only server binding.

## Invalidation and sign-in

An actual mode change updates configuration and deletes every session for
that tenant application's memberships in one serializable database
transaction. This includes JWT, COOKIE, expired, and legacy session rows.
Other tenant applications retain their sessions. Switching back cannot
restore deleted records; users must sign in again.

Session issuance reads the selected mode and checks the integration's
requested mode within its own serializable transaction. For a concurrent
change, an old-mode issuance that commits first is deleted by the change;
an issuance ordered after the change rejects the old requested mode. This
does not depend on a new application-level lock. The existing SQLite adapter
queues transactions on its connection, and SQLite transaction isolation
prevents stale writes from committing on other connections. Transaction
contention or failure aborts issuance rather than accepting a stale session.

Central HTTP sign-in explicitly supplies its requested mode, including the
JWT default for older callers. Direct email/username sign-in library callers
can optionally supply `mode`; omitting it issues the currently selected
credential, preserving their existing behavior.

## Consuming application configuration

Keep the backend integration and browser client configured for exactly one
mode. After changing central configuration, update the consuming application's
`sessionMode` to match before signing in again. COOKIE also requires the
configured public origin and cookie settings described in
[cookie integration](cookie-integration.md). There is no automatic fallback
to another credential type when configuration mismatches.

For the local demo, restart with DEMO_SESSION_MODE set to the root tenant's
new mode and matching cookie options when necessary. The `/cookie/` route
remains explicitly configured for COOKIE; its tenant application must match.
The admin UI does not silently rewrite consuming-server environment variables.

## Verification

HTTP checks cover both switch directions, multiple affected sessions,
expired/legacy deletion, unchanged and invalid saves, rollback, creation
defaults, unaffected tenants, fresh sign-in, and overlapping password sign-ins
with a mode change. The concurrency test overlaps real requests and accepts
only valid pre-change JWT responses or rejected old-mode sign-ins; any issued
pre-change credentials remain invalid after switching back.

The real-browser test edits modes in the actual built admin UI, exercises both
browser/demo library flows, checks forced reauthentication and old credential
replay, and confirms the other tenant remains authenticated. All fixtures
use temporary SQLite databases and isolated browser profiles. No schema
migration or change to real customer modes is required by this ticket.
