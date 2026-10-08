# Ticket 03 implementation proposal

Status: Approved by the user on 2026-10-08; implemented and reviewed.

## Intended result

The same demo application supports two tenant applications: one remains in
JWT mode and the second uses a session cookie. Cookie-mode users sign in,
reload the browser, and access their protected identity without a JWT in
browser storage. Both modes keep central verification and two-hour expiry.

## Central session behavior

- Reuse the schema introduced by ticket 02; no additional migration is needed.
- In COOKIE mode, issue a cryptographically random opaque token, persist only
  its hash with the membership, strategy marker, and fixed expiry, and return
  it only to the consuming application server.
- Extend verification to accept an explicitly identified credential mode and
  require it to match both the stored session and tenant application's mode.
  JWT verification retains its signature, audience, and central-session checks.
- Cookie-mode issuance does not require the JWT signing secret. Neither mode
  accepts the other mode's credential as a fallback.

## Backend and browser libraries

- Add explicit session-mode configuration to the consuming integration,
  defaulting to JWT for existing callers. The central configuration remains
  authoritative and mismatches are denied.
- COOKIE mode requires the application's configured public origin, so browser
  request protection uses a known origin rather than trusting the request's
  Host header.
- Set a host-only, tenant-application-scoped authentication cookie with
  HttpOnly, SameSite=Lax, Path=/, and expiry matching the central session.
  Secure defaults to enabled. Allow an explicit insecure-cookie exception only
  for loopback HTTP development.
- Strip the opaque token from browser-visible sign-in responses. Return only
  the selected mode and expiry; browser JavaScript never receives the session
  credential in cookie mode.
- The browser library supports either configured mode. COOKIE mode sends
  same-origin cookies and restores access after reload without using
  sessionStorage for credentials. JWT behavior remains unchanged.

## CSRF protection

- Provide a same-origin CSRF bootstrap endpoint that sets a separate signed
  anti-CSRF cookie and returns the token to the browser library.
- Require that token in a custom header on cookie-mode sign-in and on protected
  state-changing requests. Validate its signature and match it to the CSRF
  cookie, with bounded input and constant-time comparisons.
- Also require the request's Origin to match the configured application origin
  on those state-changing requests. Reject missing or foreign origins and
  missing, mismatched, or forged CSRF tokens before creating sessions or
  reaching protected handlers.
- Use a server-local random signing key for CSRF tokens; restarting the server
  requires obtaining a fresh CSRF token, not signing in again for an otherwise
  valid session. No application-server credential provisioning is introduced.
- Logout remains ticket 04; document that its handler must use this protection.

## Demonstration and verification

- Extend the demo configuration to expose each tenant application's mode and
  provide a protected state-changing action so CSRF behavior is verifiable.
  Keep the browser on its application's origin and each route's intended
  tenant application fixed by server configuration.
- Create/configure cookie-mode fixtures only in temporary test databases. Do
  not change customer records or session modes in the application database
  merely to populate the demonstration.
- Verify cookie issuance, token redaction, session expiry, tenant isolation,
  wrong-mode rejection, and central invalidation through real HTTP integration.
- Use real Edge/Chromium interactions to verify HttpOnly visibility, cookie
  attributes and delivery, reload persistence, legitimate mutations, and CSRF
  rejection without state changes.
- Preserve JWT and administration tests, run type checks/builds, and review
  against starting commit `e4e73a14c2d6411d3f39003379e482c3a591a259` before
  committing scoped source changes. Keep the local database upgrade separate.

## Exclusions

Logout, administrator mode editing/invalidation, and complete outage UX remain
with later tickets. No SSO, MFA, server credentials, public registration, or
production deployment is added.
