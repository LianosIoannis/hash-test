# Cookie sign-in and protected requests

Ticket 03 adds opaque cookie sessions to the existing JWT integration. The
central server issues a random 256-bit credential and persists only its
SHA-256 hash, membership, COOKIE marker, and fixed two-hour expiry. The
consuming server sets its own cookie; browser-visible sign-in responses
contain only `{ mode: "COOKIE", expiresAt }`.

## Backend integration

```ts
const auth = createBackendAuth({
  centralUrl: "http://127.0.0.1:3000",
  tenantApplicationKey: "cookie-tenant-application-key",
  sessionMode: "COOKIE",
  publicOrigin: "https://your-application.example",
});
app.use("/auth", auth.router);
app.get("/identity", auth.authenticate, (request, response) => response.json(request.auth));
app.post("/action", auth.authenticate, performYourAction);
```

`publicOrigin` is the browser application's configured origin, including its
port when applicable. It must be an origin without a trailing slash or path.
The library never derives the permitted Origin from an incoming Host header.
Both libraries default to JWT when `sessionMode` is omitted. Central
configuration must match; there is no alternate-credential fallback.

Cookies are host-only, scoped by tenant application in their names, HttpOnly,
SameSite=Lax, and Path=/. HTTPS cookies are Secure and use the `__Host-` prefix.
For loopback HTTP only, explicitly set `allowInsecureCookies: true` and use a
loopback HTTP `publicOrigin`. This exception is rejected for other hosts and
for HTTPS. Use the exact same hostname in configuration and browser URLs.

Every protected request still contacts central verification and exposes the
same five identifiers as [JWT mode](jwt-integration.md). Invalid sessions
return 401; unavailable central verification returns 503. Cookie issuance and
verification do not require JWT_SECRET. Requests never refresh session expiry.

## Browser integration and CSRF

```ts
const auth = createAuthClient({
  tenantApplicationKey: "cookie-tenant-application-key",
  sessionMode: "COOKIE",
  basePath: "/auth",
});
await auth.signIn(email, password);
await auth.request("/identity");
await auth.request("/action", { method: "POST" });
```

Cookie mode uses same-origin browser cookie delivery. `getToken()` returns
null, and the library neither reads nor writes credentials in browser storage.
After reload, call `request` to restore access using the existing cookie.

Before sign-in and unsafe protected requests, the library obtains a CSRF
proof from GET `/auth/csrf`. That endpoint sets a separate HttpOnly cookie
and returns a signed proof. The application requires a matching custom
`X-CSRF-Token` header, a valid signature, and an Origin equal to `publicOrigin`
for methods other than GET, HEAD, and OPTIONS. Failed proofs return 403 before
sign-in or protected handlers execute. Keep safe methods free of mutations.

Proofs use a server-local random signing key. Bootstrap reuses valid proofs
to support concurrent requests and obtains new proofs after server restart;
unexpired authentication sessions remain valid. Deploying multiple consuming
instances and coordinating their CSRF keys is outside this local v1 setup.
Logout is ticket 04 and must use the same router protection.

## Two-tenant local demonstration

Create the same application in two tenants, with one user and membership per
tenant, and enable EMAIL_PASSWORD for both. Keep the first tenant application
in JWT mode and configure the second as COOKIE. Until ticket 05 introduces
administrative mode editing, configure COOKIE through Prisma **only for a
fresh disposable fixture without existing sessions**:

```ts
await prisma.tenantApplication.update({
  where: { key: "your-disposable-cookie-key" },
  data: { sessionStrategy: "COOKIE" },
});
```

This direct fixture update does not implement mode-change invalidation and
must not be used as an administrative workflow for existing sessions. Tests
perform this setup only in temporary databases; implementation does not seed
or change customer records in the application database.

Run the central server with `npm run dev`. In a separate PowerShell terminal:

```powershell
$env:DEMO_TENANT_APPLICATION_KEY = "your-jwt-key"
$env:DEMO_COOKIE_TENANT_APPLICATION_KEY = "your-disposable-cookie-key"
$env:DEMO_PUBLIC_ORIGIN = "http://127.0.0.1:3001"
$env:DEMO_ALLOW_INSECURE_COOKIES = "true"
npm run demo:dev
```

Open `/` for JWT and `/cookie/` for COOKIE on that demo origin. Both use the
same Express server and demo UI with separately configured tenant routes.
Sign in, reload, check identity, and increment the protected counter. To run
COOKIE as the sole root demo instead, set DEMO_SESSION_MODE=COOKIE and supply
its key as DEMO_TENANT_APPLICATION_KEY.

## Verification

`npm run test:integration` covers both modes through real HTTP and temporary
SQLite databases. `npm run test:browser` covers JWT and COOKIE reloads, browser
storage, cookie attributes, protected mutations, concurrency, and Secure
cookie delivery over HTTPS, alongside the administration smoke check.

The localhost certificate and key under `test/support/localhost-*.pem` are
public test fixtures, not deployment credentials. Certificate verification
is relaxed only for the isolated HTTPS browser fixture. Application libraries
retain normal TLS verification.
