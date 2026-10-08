# Public authentication libraries

The repository-local TypeScript entry points are `src/library/backend.ts`,
`src/library/browser.ts`, and the shared types in `src/library/contracts.ts`.
`npm run build` emits their JavaScript and declarations under `dist/library/`.
There is no published package or independent installation contract yet.

The browser calls its own application server. That server calls central
authentication. Consuming code imports the public libraries, not central
authentication internals, Prisma, or database actions. The central server owns
password validation, memberships, signing, and session validity.

## Express backend

From an example file at the repository root:

```ts
import express from "express";
import { createBackendAuth } from "./dist/library/backend.js";

const app = express();
const auth = createBackendAuth({
  centralUrl: "http://127.0.0.1:3000",
  tenantApplicationKey: "demo-cookie",
  sessionMode: "COOKIE",
  publicOrigin: "http://127.0.0.1:3001",
  allowInsecureCookies: true,
  timeoutMs: 5000,
});

app.use("/auth", auth.router);
app.get("/identity", auth.authenticate, (request, response) => {
  response.json(request.auth);
});
app.listen(3001, "127.0.0.1");
```

For JWT, set `sessionMode: "JWT"` and omit the cookie-only options. The server
fixes the intended tenant application; browser input cannot select a different
one. Instantiate a separate integration for each tenant application.

| `BackendAuthOptions` | Contract |
| --- | --- |
| `centralUrl` | Required HTTP/HTTPS central origin; operations target `/api/auth/signin`, `/verify`, and `/logout` |
| `tenantApplicationKey` | Required key, at least two characters; selects the intended tenant application |
| `sessionMode` | `JWT` or `COOKIE`; defaults to JWT and must match central configuration |
| `timeoutMs` | Positive integer; defaults to 5,000 ms, covering the central fetch and JSON-body reading |
| `publicOrigin` | Required for COOKIE; exact HTTP/HTTPS application origin, without a path or trailing slash |
| `allowInsecureCookies` | Defaults to false; true is permitted only for loopback HTTP development |

`createBackendAuth()` returns `router` and `authenticate`. The router supplies
JSON parsing and no-store auth responses. Mount it before routes that could
otherwise consume the authentication path. `authenticate` verifies every
protected request centrally and calls the next handler only after success.
COOKIE protected mutations also require valid CSRF proof.

With the router mounted at `/auth`:

| Endpoint | Request and result |
| --- | --- |
| POST `/auth/signin` | JSON `{ email, password }`; 200 returns the selected browser session; password input is 8–100 characters |
| GET `/auth/csrf` | COOKIE only; returns `{ csrfToken }` and an HttpOnly signed-proof cookie |
| POST `/auth/logout` | Current bearer token or cookie, plus CSRF for COOKIE; 204 only after successful central invalidation |

JWT sign-in returns `{ mode: "JWT", jwt_token, expiresAt }`. COOKIE sign-in
returns `{ mode: "COOKIE", expiresAt }`, and the application server sets its
own opaque-token cookie; browser JSON never exposes that token. Dates are
ISO timestamp strings. No application-server credential or central JWT
secret is required by this library in v1.

After successful middleware authentication, `request.auth` contains the
following numeric identifiers:

| Field | Meaning |
| --- | --- |
| `userId` | Authenticated tenant user |
| `tenantId` | User's customer tenant |
| `tenantApplicationId` | Intended tenant application |
| `membershipId` | User's membership in that tenant application |
| `sessionId` | Current centrally valid session |

This is authentication context, not a business-role decision. Apply your
application's roles, permissions, and resource checks after authentication.

## Framework-independent browser client

Serve `dist/library/browser.js` as a same-origin browser module (the demo
serves it at `/library/browser.js`, or `/cookie/library/browser.js`). For a
COOKIE page whose backend router is mounted at `/auth`:

```ts
import { AuthClientError, createAuthClient } from "/library/browser.js";

const auth = createAuthClient({
  tenantApplicationKey: "demo-cookie",
  sessionMode: "COOKIE",
  basePath: "/auth",
});

try {
  await auth.signIn("demo@example.test", "DemoPassword123!");
  const response = await auth.request("/identity");
  if (response.ok) console.log(await response.json());
  else console.log(`Identity unavailable (${response.status})`);
} catch (error) {
  if (error instanceof AuthClientError) console.log(error.status, error.message);
  else throw error;
}

// On an explicit logout action: await auth.logout(); handle rejection too.
```

The browser code is a module example to serve or bundle in your application,
not a Node.js import. For the mounted COOKIE demo, its generated configuration
uses `basePath: "/cookie/auth"` and requests `/cookie/identity`. JWT uses
`basePath: "/auth"` and `/identity`. The browser tenant key scopes storage;
the backend configuration remains authoritative.

| Browser interface | Contract |
| --- | --- |
| `createAuthClient({ tenantApplicationKey, sessionMode?, basePath? })` | Mode defaults to JWT and base path to `/auth`; authentication endpoints must be same-origin |
| `signIn(email, password)` | Resolves the selected session shape; JWT is saved in scoped sessionStorage; failures reject |
| `request(path, init?)` | Same-origin fetch returning a Response; supplies the configured credential and COOKIE CSRF proof for unsafe methods; caller handles status/body |
| `getToken()` | JWT string or null; always null in COOKIE mode |
| `logout()` | Resolves only on 204; rejects on unconfirmed invalidation; removes scoped JWT even on failure |
| `AuthClientError` | Error with readonly numeric `status`, plus its message |

`request()` does not parse JSON, retry requests, or treat 503 as successful
authentication. Browser network failures can reject with native errors.
COOKIE proof bootstrap can also reject. Handle both HTTP responses and
exceptions; do not show successful logout when `logout()` rejects.

## Session and failure behavior

- JWT uses `Authorization: Bearer <jwt>` and tab sessionStorage. Reloads
  preserve the credential, and a 401 removes its scoped storage entry.
- COOKIE uses an opaque token in a host-only HttpOnly, SameSite=Lax cookie
  with Path=/ and Secure under HTTPS. The explicit loopback HTTP option is
  the local demonstration exception. Cookie names are tenant-application
  scoped; credentials cannot select another configured tenant application.
- COOKIE sign-in, logout, and protected mutations require the configured
  Origin, signed matching CSRF cookie, and `X-CSRF-Token`. The browser client
  obtains proof from `/csrf`. CSRF rejection precedes any logout cleanup.
- Both modes expire two hours after issuance. There is no refresh token,
  request renewal, offline JWT acceptance, or cached verification success.
- Successful logout invalidates only the current central session. Changing
  a tenant application's mode invalidates all its sessions permanently,
  including when changing back; other tenant applications remain usable.
- Central timeout or outage returns 503 and blocks the protected handler.
  Verification 503 retains local credentials for recovery without renewal.
- Failed central logout clears local JWT storage or the server's cookie and
  reports unconfirmed invalidation. The former central session may remain
  valid until expiry or successful logout. Browser code cannot clear HttpOnly
  cookies if the application server itself is unreachable or rejects CSRF.

| Status | Meaning at the consuming application |
| --- | --- |
| 400 | Invalid local sign-in input |
| 401 | Rejected sign-in or invalid/expired/missing session |
| 403 | COOKIE CSRF proof rejected before state change |
| 503 | Central authentication unavailable, timed out, or returned an unusable result; logout invalidation unconfirmed |

For details, see [logout](logout.md), [mode administration](session-modes.md),
[central failures](central-failures.md), and [the runnable setup](local-demo.md).
V1 is local-only. Azure SSO/MFA flows, remote administration, server credentials,
account lifecycle and production deployment remain deferred.
