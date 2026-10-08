# Application database migration

Completed on 2026-10-08 at the user's request.

- Applied `20261008000000_jwt_sessions` with Prisma migrate deploy.
- Prisma reports all three migrations applied and the schema up to date.
- Created a consistent SQLite backup before migration:
  `backups/auth-before-jwt-1791454171163.db`.
- Verified existing records were unchanged in tenants, applications, tenant
  applications, users, memberships, sessions, strategies, Azure configurations,
  and TOTP authenticators.
- Verified SQLite integrity and foreign keys.
- Existing tenant applications are configured for JWT; existing sessions retain
  a null legacy strategy marker and require fresh sign-in for new verification.
- The backup directory is ignored by Git. The migrated application database
  remains a local data change, separate from source implementation commits.
