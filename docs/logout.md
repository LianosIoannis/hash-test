# Current-session logout

Ticket 04 adds `logout()` to the framework-independent browser client and a
POST `/logout` endpoint to the backend authentication router. The demo's
**Log out** button uses that public client method in both modes.

```ts
await auth.logout();
```

With the router mounted at `/auth`, the browser calls POST `/auth/logout` on
its own origin. JWT mode sends the current bearer token; COOKIE mode sends
the HttpOnly cookie and obtains the same signed CSRF proof as protected
mutations. The consuming server supplies its configured tenant application
and mode to central POST `/api/auth/logout`.

Central logout verifies the credential using the same expiry, membership,
tenant-application, selected-mode, and JWT-signature checks as protected
requests, then deletes only that session. Other sign-ins for the same user
and sessions in other tenant applications stay valid. No request-body
session ID can select another session for deletion.

Successful logout returns 204. The JWT client removes its scoped
sessionStorage entry; the consuming server expires its authentication cookie
using the original host-only name, Path=/, HttpOnly, SameSite=Lax, and Secure
configuration. Replaying the old credential returns 401 centrally and through
protected routes. Reloading does not restore access; a fresh sign-in creates
a new usable session. Already invalid or expired credentials return 401
rather than claiming a new central invalidation succeeded.

## Rejected and failed requests

Cookie logout requires the signed matching CSRF header/cookie and configured
Origin. Missing, forged, or foreign-origin proofs return 403 before logout
runs. These rejected requests neither delete the central session nor expire
the authentication cookie.

For an accepted logout request, the consuming server clears its cookie even
if central logout fails. The JWT client clears its credential when its logout
attempt completes, including a failed request. Central failures return 503;
the browser rejects instead of claiming central invalidation succeeded. A
failed central invalidation can leave the former credential valid until
expiry or a successful retry. If cookie CSRF bootstrap fails or a request
cannot reach the consuming server, browser JavaScript cannot clear the
HttpOnly cookie; the client reports the failure. See
[central failures](central-failures.md) for the timeout and recovery contract
and ticket 06's HTTP and browser verification.

## Verification

`npm run test:integration` checks current-session-only invalidation, wrong
tenant and mode rejection, CSRF failures without session/cookie effects,
credential replay, unaffected sessions, and fresh sign-in through real HTTP.
`npm run test:browser` verifies actual JWT storage and cookie removal, denied
browser access after reload, CSRF rejection, replay, fresh sign-in, and Secure
cookie deletion under HTTPS. All databases and browser profiles are temporary.
