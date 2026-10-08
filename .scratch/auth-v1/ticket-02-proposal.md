# Ticket 02 implementation proposal

Status: Approved, implemented, and reviewed; no outstanding findings.

## Intended result

A tenant user signs in with email/password through the browser library and
separate Express demonstration server, receives only a JWT, reloads the tab,
and accesses a protected identity endpoint. Every protected request is
verified by the central authentication server.

## Persistence and compatibility

- Add a session-strategy enum with JWT and COOKIE values and a JWT-defaulted
  selection on each tenant application. COOKIE is reserved for ticket 03;
  ticket 02 rejects unsupported cookie-mode issuance instead of falling back
  to JWT.
- Add a nullable strategy marker to sessions. Existing rows retain a null
  marker and are treated as legacy sessions: preserved for administration,
  but rejected by the new request verification flow.
- Store the hash of the issued JWT in the existing session token-hash field.
  Include a unique JWT identifier so separate sign-ins cannot produce the
  same token. Bind the stored session to the existing membership and fixed
  two-hour expiration.
- Verification checks the signed JWT and then its corresponding central
  session, membership, tenant application, expiry, and selected strategy.
  Returned identity comes from the central records, not unverified claims.
- Stop returning an opaque session token alongside the JWT. Preserve email
  and username credential checks and exact enabled-strategy behavior; update
  existing tests to assert the new selected-mode response contract.
- Generate updated Prisma types and test migrations only against temporary
  databases. Applying migrations to the application's database is separate
  from implementation and will not happen automatically.

## Integration shape

- Central HTTP operations: email/password sign-in and JWT session
  verification. Reuse the existing application factory and error handling.
- Backend library: configure the central URL and intended tenant application;
  forward sign-in and provide Express middleware that verifies the bearer
  credential centrally on every request. Expose the five agreed identity
  identifiers on authenticated requests.
- Browser library: same-origin sign-in, sessionStorage persistence scoped to
  the configured tenant application, and protected fetch with a bearer header.
  A reload retains the credential without renewing its expiry.
- Demo: a separate local Express server serves a minimal browser UI and
  authentication endpoints. Protected route configuration fixes the intended
  tenant application; a presented JWT cannot change it.
- Use repository-local public library entry points initially, with build and
  type-check coverage. No monorepo conversion or npm publication is needed.
- Invalid credentials or sessions are denied; protected invalid sessions return
  401. Failed central verification returns 503 without executing the handler.
  Include a bounded timeout; broader failure UX remains in ticket 06.

## Validation

Use the already approved integration and real-browser boundaries:

- HTTP journey through the consuming server, using real central authentication
  and isolated SQLite fixtures.
- Reject invalid passwords, absent memberships, disabled exact strategies,
  tampered/expired JWTs, wrong tenant applications, wrong modes, legacy
  sessions, and centrally invalidated sessions.
- Verify two tenants sharing an email remain isolated, and inspect the five
  authenticated identifiers through the protected endpoint.
- Verify the fixed two-hour lifetime without waiting two hours.
- Extend the existing Edge test path for real sign-in and reload interactions;
  use a temporary profile and test public browser behavior. Do not claim DOM
  loading alone verifies JWT persistence.
- Run administration regressions, type checks, builds, and the existing
  benchmark. Review against starting commit
  `cb5e6bb70116f79b8ff40ea85999e03debccb2d4`, then commit scoped changes.

## Exclusions

Cookie sign-in, logout, administrator mode editing/invalidation, and complete
failure UX remain with their approved later tickets. Azure SSO, MFA, server
credentials, registration, and production deployment remain outside v1.
