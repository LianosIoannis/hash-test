# Authentication testing baseline

Established for v1 ticket 01 on 2026-10-08, starting from commit
`15d3a21891548d2b834b70acee1f41d919529892`.

## Existing checks

Before changes, all eight administration tests passed. Backend and browser
type checks, the backend build, and the browser build passed. No existing
behavior or build failure was observed. The sandbox process launcher failed
intermittently; running checks through the approved alternate execution path
resolved that environmental problem.

Commands:

- `npm run test:admin`: existing administration regression suite.
- `npm run test:integration`: administration plus two-tenant HTTP baseline.
- `npm run test:browser`: builds the browser UI and runs a real Chromium smoke
  check against an isolated API and a separate same-origin UI server.
- `npx --no-install tsc --noEmit`: backend type check.
- `npx --no-install tsc --noEmit -p client/tsconfig.json`: browser type check.
- `npm run build` and `npm run client:build`: builds.
- `npm test`: existing Argon2 performance benchmark, not the integration suite.

The admin test contains existing Biome template-literal suggestions; this
ticket does not rewrite unrelated assertions solely to remove those notices.

## Isolated integration setup

`test/support/integration.mjs` creates a fresh database under the operating
system's temporary directory, applies migrations in order, and starts the
admin API on an available loopback port. `startServer` starts additional
Express applications the same way. Teardown closes all registered servers,
disconnects Prisma, restores environment variables, and removes only the
verified temporary fixture directory. Cleanup runs even if setup fails.

The fixture supplies an explicit test-only JWT secret. It never reads or
modifies the application's database. Migration paths resolve relative to
the helper, not the shell's current directory.

Use one `createIntegration(t)` per test process, before importing application
modules. Prisma is currently a module singleton. Keep Node's default process
isolation between test files; do not disable it. The helper intentionally
rejects a second fixture in the same process rather than silently reusing a
previous database.

`seedTenantFixtures(base)` provisions through the public administration API:

- One application associated with two tenants.
- One user in each tenant, both using `shared@example.test` and `shared-user`.
- One membership per user in that user's tenant application.

Strategies are initially unconfigured, matching administration defaults.
Later journeys can enable the required strategy through the API. Session
modes are not implemented by this baseline ticket.

The existing admin migration-preservation fixture remains inserted between
migrations, and its membership/session preservation assertions remain active.

## Behavior to preserve

- Sign-in resolves credentials within the tenant identified by the tenant
  application. Email and username sign-in require their exact enabled
  password strategy; enabling an OTP variant does not enable plain password
  sign-in.
- Disabling an authentication strategy blocks new sign-ins but does not
  invalidate existing sessions. Session-mode changes are a separate v1 rule.
- Cross-tenant memberships are rejected. The baseline HTTP test also verifies
  tenant-filtered retrieval when different tenants use the same email.
- Invalid strategy/config enablement rolls back. Configuration deletion
  disables and preserves its strategy; recreation reuses it.
- Azure secrets and password hashes are omitted from administration responses.
  Omitted Azure secrets survive edits; server/SPA configuration constraints
  and duplicate-name checks remain enforced.
- Changing user contact details clears verification, including when submitted
  with a verification override. TOTP secrets and replay counters stay hidden.
- Migrations preserve existing memberships and sessions without database reset.

## Real-browser verification path

Run `npm run test:browser`. On this Windows setup it uses installed Edge at
`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. On other setups,
set `BROWSER_EXECUTABLE` to an installed Edge or Chromium executable. A missing
browser is a test failure, not a silently skipped check.

The browser runs headlessly with a fresh profile inside the temporary fixture
directory. It loads the actual built admin UI, executes its JavaScript, calls
the same-origin overview endpoint backed by the real API, and verifies visible
tenant, application, and membership counts. It uses no normal browser profile
and adds no npm dependencies.

The original DOM smoke check is not proof of sign-in flows. Ticket 02 adds
an interactive browser journey for JWT sign-in, actual reload persistence,
and central session invalidation using an isolated Chromium debugging session.
`npm run test:browser` builds and runs both paths; HTTP coverage also includes
the JWT integration suite. See [JWT integration](jwt-integration.md).

Ticket 03 adds cookie attributes and delivery, CSRF, concurrent mutations,
and reload coverage, including an isolated localhost HTTPS fixture. The suite
now has 21 HTTP and 4 browser tests. See [cookie integration](cookie-integration.md).
Ticket 04 adds current-session logout, actual credential removal, replay
denial, CSRF preservation, and fresh sign-in checks. The suite now has 26 HTTP
and 7 browser tests. See [logout](logout.md). Its HTTP and browser tests share
the consuming-demo setup in `test/support/demo.mjs`, while retaining separate
public-boundary assertions. Ticket 05 adds atomic mode changes, permanent
invalidation, creation defaults, rollback and concurrency checks, and a real
admin-to-demo browser journey. The suite now has 30 HTTP and 8 browser tests.
See [session modes](session-modes.md). Browser files run sequentially to avoid
concurrent Edge startup timeouts; isolated browser shutdown is bounded, with
termination limited to the launched test process tree when graceful exit stalls.
Future tickets add complete failure handling. The original DOM smoke runner
remains an admin rendering check; the interactive runner verifies actual
sign-in, reload, logout, and mode changes.
