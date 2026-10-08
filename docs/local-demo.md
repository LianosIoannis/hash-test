# Run the local two-tenant demonstration

Run commands from the repository root. This workflow is verified on Windows
PowerShell with Node.js 24 and npm. Install an Edge or Chromium browser for
the real-browser tests. See [testing](testing-baseline.md) for other browser
executable paths.

## Dependencies and central configuration

```powershell
npm ci
npm --prefix client ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` locally. Keep an existing file and its database configuration.
For a new local database, use `DATABASE_URL="file:./data/auth.db"`. Set
`JWT_SECRET` to a newly generated random secret of at least 32 bytes. For
example, generate one with:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Keep this secret on the central server. The consuming demo does not need the
secret or database access, even though this repository's local terminals may
load the same `.env` file. Do not commit your `.env`.

## Generate and deploy existing migrations

For an existing database, stop its server and make a database backup before
upgrading. The following commands assume the default `data/auth.db` location;
adapt the directory/file paths if your DATABASE_URL points elsewhere. Deploy
checked-in migrations without reset or seed:

```powershell
New-Item -ItemType Directory -Force data | Out-Null
if (!(Test-Path data/auth.db)) { New-Item -ItemType File data/auth.db | Out-Null }
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
npm run build
```

Migration deployment preserves existing domain records. Pre-v1 session
credentials require a new sign-in; see [JWT compatibility](jwt-integration.md).
If the database was created using `prisma db push`, reconcile its schema and
migration history before deployment; do not reset it to bypass a history
conflict. These instructions apply existing migrations, not generate new ones.
The guarded empty-file creation is needed on the verified Windows setup:
Prisma deployment failed for a missing SQLite file and succeeded once the
empty file existed. It does not overwrite an existing database.

Use the explicit commands above for this workflow. The existing `npm run
migrate` invokes development migration creation and seeding, and `npm run seed`
updates fixture users' passwords and strategies. Neither is needed here.

## Start central authentication and local administration

In one terminal:

```powershell
$env:PORT = '3000'
npm run dev
```

In a second terminal:

```powershell
npm run client:dev
```

Open [local administration](http://127.0.0.1:5173). The central API listens at
`http://127.0.0.1:3000`; the admin UI proxies `/api` there. Keep these default
ports together unless you also update the admin proxy in `client/vite.config.ts`.
The central listener is bound to loopback and administration is unauthenticated.

## Create the two tenants through administration

Use unused names and keys if your database already has these records. Reuse
only fixtures you intend to administer; do not overwrite other tenants.

| Screen | Create |
| --- | --- |
| Applications | Name `Demo application`, code `local-demo` |
| Tenants | `Demo JWT tenant` and `Demo COOKIE tenant` |
| Tenant applications | Associate each tenant with the same `Demo application`; keys `demo-jwt` and `demo-cookie`; modes `JWT bearer` and `Session cookie`, respectively |
| Users | One user under each tenant, both with email `demo@example.test`, username `demo-user`, and a local example password such as `DemoPassword123!` |
| Memberships | Assign each user only to their own tenant application |

In **Tenant applications**, open **Manage strategies** (the key icon) for
each record. Enable the exact `EMAIL_PASSWORD` strategy. An unconfigured or
disabled strategy rejects sign-in. The same email identifies distinct users
in the two tenants; membership alone cannot cross their boundaries.

These are administrator-created fixtures. No public registration, seed, or
direct database provisioning is needed.

## Start the separate consuming demo

In a third terminal, adjust keys to match the records you created:

```powershell
$env:CENTRAL_AUTH_URL = 'http://127.0.0.1:3000'
$env:DEMO_TENANT_APPLICATION_KEY = 'demo-jwt'
$env:DEMO_SESSION_MODE = 'JWT'
$env:DEMO_COOKIE_TENANT_APPLICATION_KEY = 'demo-cookie'
$env:DEMO_PORT = '3001'
$env:DEMO_PUBLIC_ORIGIN = 'http://127.0.0.1:3001'
$env:DEMO_ALLOW_INSECURE_COOKIES = 'true'
npm run demo:dev
```

The demo server binds to loopback and serves both its UI and application auth
routes. Open [JWT tenant](http://127.0.0.1:3001/) and use the navigation link
to [COOKIE tenant](http://127.0.0.1:3001/cookie/). Each page signs in with its
configured tenant application, shows the authenticated identity, and provides
protected counter and logout buttons. Use the same example email/password in
both; the returned tenant and user identifiers differ.

`DEMO_PUBLIC_ORIGIN` must exactly match the origin you open: scheme, hostname,
and port, with no path or trailing slash. Do not substitute `localhost` in
the browser while configuring `127.0.0.1`. The insecure-cookie option is an
explicit loopback HTTP exception. Normal HTTPS integrations require Secure
cookies; HTTPS deployment is not supplied by this demo startup command.

The example `.env` contains these values too. Explicit terminal variables
take precedence. For a single tenant, omit the cookie tenant key and configure
the root mode as JWT or COOKIE; COOKIE still needs the origin and cookie settings.
After a build, `node dist/demo/server.js` starts the compiled demo without watch
mode; `npm start` starts the compiled central server.

## Exercise the session contract

1. Sign in at `/`, reload, and check that the JWT identity persists in the tab.
2. Navigate to `/cookie/`, sign in, reload, and check that its identity persists.
   COOKIE uses an HttpOnly cookie, not sessionStorage. The JWT remains separate.
3. Increment the counter and log out in COOKIE mode. Navigate back to `/`;
   the JWT tenant is still signed in. Log out there to remove that JWT too.
4. Both sessions expire two hours after issuance without renewal. A request
   or reload cannot extend this lifetime; sign in again after expiry.
5. Changing a tenant application's mode through administration invalidates
   all its sessions, including JWTs. Changing back does not revive them.
   Other tenant applications remain valid. Update the consuming configuration
   to the new mode and restart before signing in again; the two-page example
   expects its primary tenant to use JWT and its second tenant to use COOKIE.
6. While signed in, stop the central server with Ctrl+C and check identity.
   The demo reports temporary unavailability rather than accepting the session
   locally. Restart central authentication to resume an unexpired session.
   Logout during the outage clears local credentials and reports that central
   invalidation was not confirmed; a copied credential may still work after
   recovery until expiry or successful central logout.

The browser library supplies signed CSRF proof for COOKIE sign-in, logout,
and protected mutations. Missing or invalid proof is rejected before changes
or cookie cleanup. See the [library reference](library-reference.md) for
configuration, interfaces, and status handling.

## Verify the complete example

```powershell
npm run test:integration
npm run test:browser
npx tsc --noEmit
npm run typecheck:browser-library
npx tsc --noEmit -p client/tsconfig.json
npm test
```

Tests use temporary databases and isolated browser profiles, never the
application database. The two-tenant host checks use the same mounting logic
as `src/demo/server.ts`; earlier suites cover isolation, expiry, CSRF, logout,
mode changes and outages. Stop local watch servers with Ctrl+C when finished.
