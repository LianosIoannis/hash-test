# Project plan

Status: V1 implementation in progress — baseline and JWT integration complete;
cookie integration is next. Later milestones remain proposed.

This document describes what the project should achieve, for whom, and how
we intend to build it. Update it as goals and priorities become clearer.
Listing a milestone here does not authorize implementation or big changes.

## Purpose

Serve as the central authentication system for a company with many
applications and customer tenants. In this project, a company "client" means
a tenant the company serves. Applications integrate with a shared
authentication system through backend and client libraries.

"Application client" refers to the software communicating with a server,
such as a browser application; it is distinct from a customer tenant.

## Intended deliverables

- **Backend library:** provides authentication behavior for the central
  authentication server and exposes a middleware-like function that
  consuming application servers use to authenticate incoming requests.
- **Client library:** handles communication between application clients and
  their same-origin application server, which forwards authentication
  operations to the central authentication server.
- **Central authentication server:** provides the authentication endpoints
  used through application servers and issues application sessions after
  successful authentication.

The package structure, supported runtimes, and communication contracts are
still to be decided.

## Intended users and use cases

- Users belonging to customer tenants sign in to company applications through
  the central system.
- Application servers use the backend library's authentication function to
  authenticate requests.
- Who administers tenants, users, and tenant applications? To decide.
- Which application will consume authentication first? To decide.
- How do users join a tenant and receive memberships? To decide.
- What should the first usable version let a user accomplish? To decide.

## Intended Azure client sign-in

For `AZURE_SSO_CLIENT`:

1. The application client obtains an Azure ID token (`id_token`).
2. The client supplies that token through its application server to the
   central authentication server.
3. The server validates it and, when the application's sign-in requirements
   are satisfied, establishes a session.
4. The server returns a JWT or establishes a cookie-based session according
   to the configured session strategy.
5. Subsequent requests to application servers are authenticated using the
   backend library's middleware-like function.

This describes the intended flow, not implemented behavior. Token validation,
mapping an Azure identity to a tenant user and membership, and session
strategy configuration still need explicit contracts.

## Intended session strategies

Support both JWT authentication and session-cookie authentication, with an
explicit configuration choice of which mode to use. This is a requirement
for the intended system; first-release coverage remains to be agreed.

Agreed: configure the session mode per tenant application. Different tenants
may therefore select different session modes for the same application.
Each tenant application selects exactly one mode: JWT or session cookie.
Changing that mode invalidates all existing sessions for that tenant
application, including previously issued JWTs. Users must sign in again using
the newly selected mode. Sessions for other tenant applications are unaffected.

- **JWT mode:** issue a JWT after successful sign-in. The application client
  presents it on subsequent requests, and the backend library authenticates
  those requests. Requests use `Authorization: Bearer <jwt>`.
- **Session-cookie mode:** establish a session using a cookie. Subsequent
  requests include the cookie, and the backend library authenticates them.
  The cookie carries an opaque session token whose hash is stored centrally.

Agreed for the first release:

- Browser applications call their own application server on the same origin.
  That server forwards authentication operations to the central server.
- In session-cookie mode, the application server sets its own HttpOnly
  session cookie. Applications do not require a shared cross-domain cookie.
- Application middleware consults the central authentication server on every
  protected request for both modes, without caching verification results.
  Verification must include session validity; JWT signature verification
  alone is insufficient for accepting a request.
- If central verification is unavailable, middleware denies access.
  Protected requests return 503 when central verification is unavailable;
  invalid or expired user sessions return 401.
- Application servers using the backend library may call the central
  authentication endpoints without separate application-server credentials
  in v1. Server authentication, server allowlists, credential provisioning,
  and credential revocation are outside v1 scope. This supersedes the earlier
  proposal to require a credential per application server.
- Central verification still checks the user's session against the intended
  tenant application. A session for tenant application A must not grant access
  to tenant application B. Using the library alone does not grant user access
  to protected application endpoints; a valid user session is required.
- JWT mode persists the JWT in `sessionStorage`, surviving browser reloads
  within the tab while retaining the fixed two-hour expiry.
- Middleware accepts only the credential type configured for the intended
  tenant application.
- Session cookies use HttpOnly and SameSite=Lax. Secure is required under
  HTTPS; local HTTP development has an explicit configuration exception.
- Cookie mode protects state-changing requests against CSRF, including
  sign-in and logout.
- Successful middleware authentication attaches user ID, tenant ID, tenant
  application ID, membership ID, and session ID to the request. The consuming
  application remains responsible for its business roles and permissions.
- Both modes have a fixed two-hour lifetime, with no automatic renewal.
  Expiry requires signing in again.
- Logout invalidates the current session in the central system.
  If central logout is unavailable, clear the local credential (browser
  storage or the application server's cookie) and report that central logout
  failed. The central session may remain valid until expiry or successful
  logout; local cleanup alone does not invalidate it centrally.

The client library, authentication server, and backend authentication
middleware must work together for the selected mode. Authentication strategy
chooses how identity is verified at sign-in; session strategy chooses how
subsequent requests prove the established sign-in. Azure client sign-in must
support either session mode.

JWT is a credential format; a cookie is a way to deliver a credential.
Supporting both modes does not require issuing both credentials at every
sign-in. A tenant application uses only its selected mode.

## Current state

Implementation progress: tickets 01 and 02 are complete and reviewed. Isolated
HTTP/browser checks are established, and email/password JWT sign-in works
through the browser library, demo Express server, and backend middleware.
See [JWT integration](jwt-integration.md) for setup and legacy-session behavior.
Cookie integration, logout, and mode administration remain with later tickets.

Based on the initial code survey:

- The domain model defines tenants, applications, tenant applications,
  users, memberships, sessions, and authentication strategies.
- The local administration API and client manage these records and Azure
  SSO configuration. The admin server is unauthenticated and binds to
  loopback.
- Email and username password sign-in functions check credentials,
  membership, and the exact enabled authentication strategy.
- Session issuance creates a hashed opaque session token and a JWT.
  Application-facing session verification and logout need a defined flow.
- Azure SSO and MFA have configuration/schema groundwork; their sign-in
  flows are unfinished.
- Administration integration tests exist. Test and type-check execution
  remains unverified because shell startup failed during the initial review.

See [authentication administration](authentication-admin.md) for existing
behavior and [the glossary](../GLOSSARY.md) for domain terminology.

## First release scope

Agreed:

- Email/password sign-in is the first end-to-end authentication journey.
- Both JWT and session-cookie modes are included, with exactly one mode
  selected per tenant application.
- The client library supports browser applications and is written in
  framework-independent TypeScript.
- The backend library targets TypeScript on Node.js and provides Express
  authentication middleware initially.
- The first complete journey covers sign-in through the client library,
  access to an application endpoint protected by backend middleware, expiry,
  logout, and invalidation when the tenant application's session mode changes.
- Administrators create users and memberships for the first release.
- Administration remains local-only for the first release. Remote
  administrator authentication and authorization are deferred.
- The first consuming application is a demonstration application with an
  Express server and browser UI. It serves two tenants: one tenant application
  uses JWT mode and the other uses session-cookie mode. Verify both libraries,
  reload behavior, logout, expiry, mode-change invalidation, and tenant
  isolation through this integration.
- V1 runs locally with a central authentication server and a separate Express
  demonstration server that serves the browser UI. Production deployment is
  deferred.
- Public registration, invitations, and password recovery are deferred.
- Azure client SSO follows as the next authentication milestone. MFA and
  additional authentication strategies are outside the first release.

The v1 interview decisions and testing boundaries are confirmed. See the
[v1 feature spec](../.scratch/auth-v1/spec.md) for the implementation contract.
Application-server authentication is excluded from v1.

## Implementation approach

Proposed:

1. Verify existing behavior and checks before extending it.
2. Build small, complete user journeys across the necessary layers.
3. Test observable behavior, including tenant isolation and rejected access.
4. Agree on consequential choices before implementing them; record durable
   architectural decisions under `docs/adr/`.
5. Turn agreed milestones into feature specs and dependency-ordered tickets.
6. Ask for approval before big changes, as required by `AGENTS.md`.

## Proposed milestones

| Order | Milestone | Completion evidence | Status |
| --- | --- | --- | --- |
| 1 | Establish a verified baseline | Existing checks run; supported behavior and important coverage gaps are recorded | Complete |
| 2 | Complete the first library integration | Through the browser TypeScript client library, an existing user signs in with email/password and accesses an Express endpoint protected by the backend library; both configurable session modes, expiry, logout, mode-change invalidation, and tenant isolation are verified | JWT journey complete; remaining tickets open |
| 3 | Define and implement account lifecycle | Agreed registration or invitation, membership assignment, recovery, and verification journeys work end to end | Proposed |
| 4 | Add Azure client sign-in | Azure client sign-in works end to end through both libraries and supports either configured session mode | Next authentication milestone; details open |
| 5 | Prepare the agreed deployment | Administrator access, secret handling, migrations, and operational checks meet the agreed deployment requirements | Proposed |

Revise the order and scope after agreeing on the first release. Each milestone
may become several independently verifiable tickets.

## Open decisions

The following decisions are deferred beyond v1 and do not block its spec:

- How does an Azure identity map to a user and membership? Can sign-in create
  either automatically, or must they already exist?
- How are administrators authenticated and authorized to create users and
  assign memberships when administration is exposed remotely?

## Planning documents

| Document | Purpose |
| --- | --- |
| `docs/project-plan.md` | Project intent, scope, approach, priorities, and progress |
| `GLOSSARY.md` | Agreed domain terminology |
| `docs/adr/` | Durable architectural decisions and their reasoning |
| `.scratch/<feature>/spec.md` | Agreed behavior, implementation decisions, testing, and exclusions for a feature |
| `.scratch/<feature>/issues/<NN>-<slug>.md` | Actionable implementation tickets, acceptance criteria, and dependencies |

Keep detailed acceptance criteria in feature specs and tickets. Link them
from this plan once they exist rather than duplicating their contents here.
