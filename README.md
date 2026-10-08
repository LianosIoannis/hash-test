# Central authentication

Local central authentication for a company serving multiple customer tenants
through multiple applications. V1 provides email/password sign-in, one selected
JWT or COOKIE session mode per tenant application, framework-independent
TypeScript browser integration, and Node.js/Express backend integration.

Start with the [two-tenant setup guide](docs/local-demo.md). It runs a central
server, local administration, and a separate demo server with JWT and COOKIE
pages. The [library reference](docs/library-reference.md) explains integration
into another Express application. Libraries are repository-local; no npm
package has been published.

Every protected request is verified centrally. Sessions expire after two
hours, and logout or a mode change invalidates them. Application business
roles and permissions remain the consuming application's responsibility.

Administration and the demonstration remain local. V1 does not require
application-server credentials. Azure SSO, MFA, public account lifecycle,
remote administration and production deployment are deferred. Configuration
screens for a strategy do not mean its sign-in flow is implemented.

Useful documents:

- [Project plan](docs/project-plan.md) and [domain glossary](GLOSSARY.md).
- [Administration](docs/authentication-admin.md).
- [JWT](docs/jwt-integration.md), [cookies and CSRF](docs/cookie-integration.md),
  [logout](docs/logout.md), [mode changes](docs/session-modes.md), and
  [central failures](docs/central-failures.md).
- [Test setup and verification](docs/testing-baseline.md).

Run `npm run test:integration` for real HTTP/temporary SQLite tests and
`npm run test:browser` for builds and isolated real-browser journeys.
`npm test` is the existing Argon2 benchmark, not the integration suite.
