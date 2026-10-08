# V1: Central authentication libraries and demonstration application

Status: ready-for-agent

Implementation: All seven v1 tickets completed and independently reviewed on
2026-10-08. Final verification passed 34 HTTP tests, 12 real-browser tests,
type checks, builds, formatting, and the existing Argon2 benchmark. See
[the local setup guide](../../docs/local-demo.md) and
[library reference](../../docs/library-reference.md). Administration and
deployment remain local; deferred features below remain outside this release.

## Problem Statement

The company serves multiple customer tenants through multiple applications.
It needs a central authentication system and reusable integration libraries
so application developers can sign users in and authenticate requests with
consistent tenant isolation and session behavior.

The current project provides local administration and password sign-in
functions, but does not yet provide a complete browser-library-to-application-
middleware journey. Session issuance currently returns both an opaque token
and a JWT; it must instead follow the selected tenant application's mode.

## Solution

Deliver a TypeScript backend library for Node.js with Express integration,
a framework-independent TypeScript browser client library, and a local
demonstration application. The browser calls its own application server,
which forwards authentication operations to the central authentication server.

Existing, administrator-created tenant users sign in using email and password.
Each tenant application selects exactly one session strategy: JWT bearer
authentication or an opaque session cookie. Both strategies support protected
requests, fixed expiry, logout, and invalidation following a mode change.

The demonstration has a separate Express server serving its browser UI and
two tenant applications for the same application: one uses JWT, one uses
cookies. Central authentication and administration remain local for v1.

## User Stories

1. As a company administrator, I want to create tenants, so that customer identities remain separated.
2. As a company administrator, I want to associate applications with tenants, so that each customer has its own tenant application.
3. As a company administrator, I want to create users within tenants, so that customers can sign in without public registration.
4. As a company administrator, I want to assign memberships, so that users can access only their tenant applications.
5. As a company administrator, I want to enable email/password authentication per tenant application, so that sign-in follows its configured strategy.
6. As a company administrator, I want to select exactly one session mode per tenant application, so that its request authentication behavior is explicit.
7. As a company administrator, I want different tenants to choose different session modes for the same application, so that their integrations can differ.
8. As a company administrator, I want changing a session mode to invalidate existing sessions, so that the previous credentials no longer grant access.
9. As a company administrator, I want a mode change to affect only the selected tenant application, so that other tenants and applications remain signed in.
10. As a tenant user, I want to sign in with email and password, so that I can access an application where I have a membership.
11. As a tenant user, I want sign-in rejected when my credentials are invalid, so that incorrect credentials cannot establish a session.
12. As a tenant user, I want access rejected when I lack a membership, so that authentication alone does not grant application access.
13. As a tenant user, I want sign-in rejected when its authentication strategy is disabled, so that application configuration is enforced.
14. As a tenant user, I want JWT-mode sign-in to return the selected credential, so that my browser can authenticate subsequent requests.
15. As a tenant user, I want JWT-mode sign-in to survive reloads within my tab, so that reloading does not require another sign-in.
16. As a tenant user, I want cookie-mode sign-in to survive reloads, so that my browser continues using my unexpired session.
17. As a tenant user, I want my session to expire after two hours without automatic renewal, so that its lifetime is predictable.
18. As a tenant user, I want to sign in again after expiry, so that I can establish a new session.
19. As a tenant user, I want logout to invalidate my current session, so that reusing its credential no longer grants access.
20. As a tenant user, I want logout to remove my local credential, so that this browser stops sending it.
21. As a tenant user, I want a central logout failure reported after local cleanup, so that I know central invalidation did not succeed.
22. As a tenant user, I want an authentication outage distinguished from an invalid session, so that a temporary service failure is not presented as an incorrect credential.
23. As a tenant user, I want a session for one tenant application rejected by another, so that credentials cannot cross tenant-application boundaries.
24. As an application developer, I want a browser client library independent of UI frameworks, so that different browser applications can integrate it.
25. As an application developer, I want the client library to call same-origin application endpoints, so that authentication does not require shared cross-domain cookies.
26. As an application developer, I want the backend library to forward authentication operations centrally, so that each application does not implement its own authentication system.
27. As an application developer, I want Express middleware for protected routes, so that I can authenticate requests with a consistent integration.
28. As an application developer, I want middleware to accept only the configured session credential type, so that an alternate mode cannot bypass configuration.
29. As an application developer, I want every protected request verified centrally, so that logout and mode changes are enforced without cached acceptance.
30. As an application developer, I want user, tenant, tenant application, membership, and session identifiers attached after authentication, so that my application can identify the requester.
31. As an application developer, I want to retain responsibility for business roles and permissions, so that authentication does not dictate application authorization rules.
32. As an application developer, I want invalid sessions to produce 401 and unavailable central verification to produce 503, so that clients can respond appropriately.
33. As an application developer, I want cookie-mode state-changing requests protected against CSRF, so that browser credential delivery does not authorize unintended requests.
34. As an application developer, I want HttpOnly, SameSite=Lax cookies and Secure under HTTPS, so that cookie behavior follows the agreed browser contract.
35. As an application developer, I want an explicit local HTTP exception for Secure cookies, so that the local demonstration works without silently weakening HTTPS configuration.
36. As an application developer, I want to use the backend library without provisioning an application-server credential in v1, so that integration stays within the agreed scope.
37. As a project maintainer, I want a runnable two-tenant demonstration, so that both library integrations can be exercised before adopting a company application.
38. As a project maintainer, I want verification against temporary databases, so that tests never alter the application's database.
39. As a project maintainer, I want existing administration behavior preserved, so that adding authentication integrations does not regress tenant and strategy management.
40. As a project maintainer, I want migrations to preserve existing records, so that adopting the new session model does not require resetting the database.

## Implementation Decisions

- Use the agreed domain vocabulary: tenant, application, tenant application,
  user, membership, session, authentication strategy, and session strategy.
- Reuse the existing password verification, tenant lookup, membership checks,
  and exact enabled-strategy checks. Email/password is the first integration;
  existing username behavior should not be removed incidentally.
- Provide a central authentication module for sign-in, session verification,
  and current-session logout, a backend integration module for Node.js and
  Express, and a browser integration module in framework-independent
  TypeScript. Package organization is an implementation choice, not a reason
  to expand the supported platform scope.
- The central server owns session validity and issues only the credential for
  the selected mode. The application server sets or clears its own cookie;
  browser code cannot read the HttpOnly authentication cookie.
- Persist one session mode per tenant application. Extend the session model
  sufficiently to bind every issued credential, including a JWT, to a
  centrally verifiable session and its membership. Select concrete schema
  fields during implementation rather than treating JWT claims alone as
  authoritative user or membership records.
- Preserve existing database records through migrations. Declare any default
  used to backfill session-mode configuration and handle pre-v1 credentials
  explicitly; do not reset the database or silently accept legacy credentials
  that cannot satisfy the new verification contract.
- JWT requests use the Authorization bearer header. The browser library
  persists the JWT in sessionStorage; reload does not extend expiry.
  JWT verification includes signature and expiry checks plus central session
  validity and intended tenant-application matching.
- Cookie requests use an opaque session token. Persist its hash centrally,
  not the raw token. Use HttpOnly and SameSite=Lax; require Secure under HTTPS,
  with an explicit local HTTP development exception.
- Protect cookie-mode state-changing operations against CSRF, including
  sign-in and logout. Choose the concrete protection mechanism during
  implementation and verify that rejected requests do not change state.
- The consuming server supplies the intended tenant application for a
  protected route from its configured application context. A presented
  credential cannot redefine which tenant application the route accepts.
- Central verification requires a valid, unexpired, non-invalidated session
  for that tenant application and the currently selected mode. Never fall
  back to accepting another mode or locally accepting a JWT when central
  verification is unavailable.
- Middleware consults central verification on every protected request,
  without caching successful verification. Successful authentication exposes
  user ID, tenant ID, tenant application ID, membership ID, and session ID.
  Business roles and permissions remain with the consuming application.
- Sessions expire two hours after issuance. Neither requests nor browser
  reloads renew them. Refresh tokens and automatic renewal are excluded.
- Logout invalidates the current session centrally and removes the local
  credential. If central logout fails, remove the local credential and report
  the failure; do not claim the central session was invalidated. It may remain
  valid until expiry or successful logout.
- Mode changes invalidate all existing sessions for the affected tenant
  application, including JWTs. Changing back must not restore old sessions.
  Sessions for other tenant applications remain unaffected. Coordinate mode
  changes and issuance so concurrent operations cannot leave a session from
  the old mode usable after the change completes.
- Protected requests with invalid or expired sessions return 401. Central
  verification unavailability returns 503 and never reaches the protected
  handler. Use a bounded central request timeout; select its value during
  implementation.
- Application servers require no separate server credentials, allowlists,
  provisioning, or credential revocation in v1. Using the library is not a
  trusted server identity or a substitute for validating the user's session.
- Administrators create users and memberships using local administration.
  Expose session-mode selection there. Remote administrator access is excluded.
- Run the central server and a separate demo Express server locally. The demo
  Express server serves the browser UI and same-origin authentication routes.
  Demonstrate one application associated with two tenants using different
  session modes and a protected endpoint reporting authenticated identity.

## Testing Decisions

The user approved these testing boundaries before publication:

- Test the complete journey through the browser client library and demo
  application server against a real central server and temporary SQLite
  database. Prefer this public integration surface over tests of private
  helpers or mocked database interactions.
- Use real-browser checks for sessionStorage, cookie delivery and attributes,
  reload persistence, and CSRF. HTTP-only tests cannot establish browser
  storage and cookie behavior on their own.
- Keep the existing administration HTTP integration suite as the regression
  baseline. Its temporary SQLite setup, migration application, ephemeral
  server ports, and externally observable assertions provide existing prior
  art. Reuse that approach without touching the application's database.
- Test observable behavior and contract results, not internal call counts,
  private function structure, or implementation-specific database layouts.
- Cover both successful session modes, selected-mode-only issuance and
  acceptance, rejected credentials, disabled email/password strategy, missing
  membership, and credentials targeting the wrong tenant application.
- Verify tenant-scoped email lookup, including the same email used in two
  tenants, to demonstrate isolation rather than assuming unique demo emails.
- Verify two-hour expiry without waiting two hours, using controlled time or
  expired fixtures through the integration setup. Requests and reloads must
  not renew expiry.
- After logout, replay the former credential and verify denial. After a mode
  change, replay old credentials and verify denial; change the mode back and
  verify they remain invalid. Verify unaffected tenant applications still work.
- Verify central outages and timeouts produce 503 without protected-handler
  execution. Verify failed central logout clears local credentials, reports
  failure, and does not incorrectly claim central invalidation.
- Verify successful middleware requests expose the agreed identifiers and
  that cookie-mode browser responses do not expose the raw session token.
- Verify CSRF failures on cookie-mode sign-in, logout, and protected mutations
  have no state-changing effect; verify legitimate requests succeed.
- Verify migrations preserve existing domain records and handle legacy
  sessions according to the documented compatibility behavior.
- Run backend and browser-library type checks and relevant build checks in
  addition to behavior tests. Select browser automation tooling during
  implementation; this spec does not require a particular test framework.

## Out of Scope

- Azure client/server SSO implementation, Azure identity mapping, MFA, and
  additional new sign-in strategy integrations. Preserve existing
  configuration groundwork rather than implementing those flows in v1.
- Public registration, invitations, password recovery, and new account
  verification journeys.
- Remote administrator authentication or authorization.
- Application-server credentials, server allowlists, provisioning commands,
  credential revocation, and their management UI.
- Application business roles and permission enforcement.
- Refresh tokens, automatic renewal, persistent JWT localStorage, shared
  cross-domain cookies, and simultaneous session modes per tenant application.
- Offline JWT acceptance and cached central verification results.
- Production deployment, frameworks other than the initial Express
  integration, native/mobile clients, and non-TypeScript libraries.
- Unrelated architecture refactoring or mechanical renaming of existing
  persistence entities solely to match glossary terminology.

## Further Notes

- This spec synthesizes the confirmed v1 interview and approved testing
  boundaries. Implementation tickets should be complete, independently
  verifiable slices with explicit blocking dependencies.
- A ready-for-agent spec is a planning artifact. It does not authorize big
  implementation changes beyond the user's existing approval requirements.
- Baseline execution was not established during the initial code survey
  because shell startup failed. Run the relevant existing checks before
  implementation and record any pre-existing failures separately.
- Tenant means a customer group served by the company. Application client
  means browser software; it does not mean a customer tenant.
- Azure client SSO is the next authentication milestone, not part of this
  release. Its identity-mapping decisions remain deferred.
