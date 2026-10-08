# JWT sign-in and protected requests

Ticket 02 supplies the first complete authentication journey: email/password
sign-in, a browser JWT, and centrally verified Express requests. Ticket 03
adds [cookie mode](cookie-integration.md); ticket 04 adds
[logout in both modes](logout.md). Administrative mode switching remains a
later ticket.

## Local setup

1. Configure `DATABASE_URL` and a random `JWT_SECRET` of at least 32 bytes in
   the central server's environment. The signing secret stays on the central
   server; consuming servers do not need it.
2. Generate types with `npx prisma generate`. Apply migrations with
   `npx prisma migrate deploy` when ready to upgrade your application database.
   Implementation tests migrate temporary databases only; the application's
   database is not upgraded automatically.
3. Through existing local administration, create a user and membership for a
   tenant application and enable its exact `EMAIL_PASSWORD` strategy.
4. Run `npm run dev` for the central server.
5. Set `DEMO_TENANT_APPLICATION_KEY` to that tenant application's key,
   `CENTRAL_AUTH_URL` to the central origin (default `http://127.0.0.1:3000`),
   and optionally `DEMO_PORT` (default `3001`). Run `npm run demo:dev`.
6. Open the demo's loopback URL and sign in. Reload the tab to verify that the
   authenticated identity remains available.

Central and demo servers remain local. Administration continues to create
users and memberships; there is no public registration or server-credential
provisioning.

## Backend integration

The repository-local public entry point is `src/library/backend.ts`, compiled
to `dist/library/backend.js` with declarations by `npm run build`.

```ts
import express from "express";
import { createBackendAuth } from "./dist/library/backend.js";

const app = express();
const auth = createBackendAuth({
  centralUrl: "http://127.0.0.1:3000",
  tenantApplicationKey: "your-configured-key",
  timeoutMs: 5000,
});

app.use("/auth", auth.router);
app.get("/identity", auth.authenticate, (request, response) => {
  response.json(request.auth);
});
```

The sign-in router fixes the intended tenant application from server
configuration, ignoring a browser-supplied tenant-application key. Middleware
accepts `Authorization: Bearer <jwt>` and contacts central verification on
every protected request, without caching or local fallback acceptance.

Successful requests receive `request.auth` containing `userId`, `tenantId`,
`tenantApplicationId`, `membershipId`, and `sessionId`. Consuming applications
enforce their own business permissions. Invalid or expired sessions return
401; unavailable or invalid central verification responses return 503 without
calling the protected handler. Central calls use a configurable timeout,
defaulting to five seconds.

## Browser integration

The browser entry point is `src/library/browser.ts`, compiled to
`dist/library/browser.js`; serve or bundle it for your same-origin browser UI.
It has no runtime dependency on the database, Express, or Node modules.

```ts
import { createAuthClient } from "./library/browser.js";

const auth = createAuthClient({
  tenantApplicationKey: "your-configured-key",
  basePath: "/auth",
});
await auth.signIn("user@example.com", "password-from-user-input");
const response = await auth.request("/identity");
```

`signIn` returns `{ mode: "JWT", jwt_token, expiresAt }` and stores the JWT
under a tenant-application and endpoint-scoped sessionStorage key. `getToken`
retrieves it, and `request` adds its bearer header to same-origin requests.
Reloading a tab retains the token but does not renew expiry. A 401 response
clears the stored token; a service outage does not pretend to invalidate it.
Cross-origin authenticated URLs and redirects are rejected.

## Session and migration contract

- Every tenant application gains `sessionStrategy`, defaulted and backfilled
  to `JWT`. Ticket 03 implements `COOKIE`; backend and browser integrations
  explicitly select their mode and reject central configuration mismatches.
- Existing sessions remain stored with a null strategy marker. They are
  visible to administration but cannot pass new request verification. Old
  JWTs also cannot pass the new issuer/audience/session-binding contract.
  Users must sign in again after upgrading.
- New sessions store a SHA-256 hash of the issued JWT and are marked `JWT`.
  The token includes a unique identifier, fixed issuer, and intended tenant
  application's audience. JWT signature and expiry checks precede the central
  session lookup; identity is obtained from the stored membership.
- Both JWT and central session expire at the same timestamp, two hours after
  the issuance time in whole seconds. Requests and reloads never renew it.
- A missing, deleted, expired, legacy, or wrong-mode central session is denied.
  A session for one tenant application cannot authenticate against another.
- The new sign-in result no longer includes `session_token`. Email and
  username credential checking and exact enabled-strategy checks remain.

## Verification

`npm run test:integration` exercises sign-in and protected requests through
real consuming and central servers against temporary SQLite databases.
`npm run test:browser` builds both clients and runs the admin smoke check plus
a real browser sign-in, reload, and central-invalidation journey.
`npm run typecheck:browser-library` checks the browser entry point and demo
without Node or Express types, in addition to the normal backend and admin
client type checks.

Browser automation uses an isolated Edge/Chromium profile and Node's built-in
WebSocket via the [Chromium DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/).
Set `BROWSER_EXECUTABLE` when the default Windows Edge path does not apply.
No new browser dependency or normal user browser profile is required.
