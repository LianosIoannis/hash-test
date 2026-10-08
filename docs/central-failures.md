# Central authentication failures

The backend library makes a central call for every sign-in, protected
request, and logout. It never verifies JWTs offline or caches successful
authentication. Central availability is therefore required for access.

## Timeout and response contract

`createBackendAuth` accepts `timeoutMs`, a positive integer in milliseconds.
The default is 5,000 ms. The fetch abort signal remains active while reading
the response body, so a server that sends headers but never completes its
JSON response cannot keep sign-in or verification waiting indefinitely.
Choose a bound appropriate to the central server's normal response time.

Invalid or expired sessions return 401. A missing local credential also
returns 401 without a central call. Connection failures, timeouts, central
service failures, and unusable success responses return 503. Failed
verification never executes the protected handler or exposes an identity.
No operation automatically retries, renews a session, or accepts another mode.

The browser client's `request()` returns the HTTP Response, allowing the
consumer to handle 401 and 503 separately. A JWT is removed from its scoped
sessionStorage entry on 401; a verification 503 preserves it. COOKIE mode
continues to use the existing HttpOnly cookie. Neither behavior extends the
central session's fixed expiry. The demo displays a temporary-service
message on 503, including during reload, rather than presenting a failed
verification as authenticated access. Browser `signIn()` rejects with
`AuthClientError`, whose `status` distinguishes service failure from invalid
sign-in. Service recovery allows the same unexpired session to resume access.

## Failed logout

JWT logout removes the local sessionStorage credential even when the central
call fails. For COOKIE mode, the application server expires its authentication
cookie before awaiting central logout. A central failure returns 503 and the
browser rejects logout: local cleanup does not confirm central invalidation.
The former credential may still be valid after recovery until its original
expiry or a successful central logout. Do not display successful central
logout or a claim that a copied credential has been revoked after failure.

CSRF checks run before cookie logout and cleanup. Rejected proofs return 403
and preserve both the cookie and central session, even during an outage.
If the browser cannot reach its own application server, or CSRF bootstrap
fails, it cannot clear an HttpOnly cookie itself; this is a reported failure,
not confirmation of cleanup. The central timeout bounds central calls, not
arbitrary application endpoints or browser-to-application network requests.

## Verification

Run `npm run test:integration` and `npm run test:browser`. The tests run the
real central application against temporary SQLite, with HTTP-boundary faults
for dropped connections, 503 responses, stalled headers, and incomplete
bodies. Both modes demonstrate bounded denial, blocked protected mutations,
local cleanup, CSRF rejection, credential replay after failed logout,
successful invalidation, expiry, and recovery. Browser checks verify visible
failure reporting, actual storage/cookie behavior, reload, and unchanged
session expiry. No customer database is changed.
