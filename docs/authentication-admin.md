# Authentication administration

The local admin API supports Azure SSO configuration CRUD and per-tenant-application strategy enablement. It remains local-only and unauthenticated. Email and username password sign-in each require their exact strategy to be enabled for the tenant application. Microsoft login and multi-factor sign-in are not implemented yet.

## Setup

1. Generate Prisma types with: npx prisma generate
2. Apply the migration with: npx prisma migrate deploy
   The migration adds tables and user contact fields without removing existing records. If you already used db push, reconcile that database with migration history first; do not reset it.
3. Run npm run dev and npm run client:dev.

Tenant applications with no enabled strategies reject new sign-ins. The seed enables EMAIL_PASSWORD for each tenant application it creates. Disabling a strategy blocks new sign-ins through it; existing sessions remain valid until expiry.

The AzureSsoConfig.clientSecret column stores the value exactly as entered, without application-level encryption. Back up and restrict access to the SQLite database accordingly. The API returns only hasClientSecret, never the secret value. If a configuration was previously saved in the encrypted v1.iv.tag.ciphertext format, replace its secret through the editor before using it for SSO.

## Screens

- Azure SSO configs: create configurations for an application and either Azure strategy, view details by opening Edit, replace secrets, or explicitly remove a SPA secret. Leaving the secret blank during editing preserves it.
- Tenant apps → Manage strategies (key icon): select a strategy and enable or disable it. Enabling Azure presents its configuration form and saves everything in one transaction.
- Deleting a configuration also disables its strategy in the same transaction. The strategy ID is retained. Re-enabling it requires a new configuration.
- User forms expose phone numbers and administrator verification overrides. Changing a contact resets its verification flag, even when an override is submitted with the change. Verify the new contact before marking it verified again. TOTP enrollment status is read-only; secrets and replay counters are not returned.

Ownership cannot change through Edit: delete and recreate to move a configuration. Names retain the schema's global uniqueness constraint. Server Azure configurations require a secret, including when disabled; SPA configurations allow one to be omitted.

## API

- GET /api/authentication-strategies: supported enum values.
- GET /api/tenant-applications/:id/strategies: configured strategies and sanitized Azure settings.
- PUT /api/tenant-applications/:id/strategies/:strategy: { enabled, azureSsoConfig? }.
- GET /api/azure-sso-configs and GET /api/azure-sso-configs/:id
- POST /api/azure-sso-configs: configuration fields plus tenantApplicationId, strategy and optional enabled (defaults to false). Creates a disabled strategy if necessary; refuses to overwrite an existing configuration.
- PATCH /api/azure-sso-configs/:id: all editable configuration fields, with ownership fixed.
- DELETE /api/azure-sso-configs/:id: disable strategy and delete configuration atomically.

Editable fields: name, optional nullable description, directoryTenantId, clientId, redirectUri, scopes, optional nullable clientSecret. Omit clientSecret to preserve it, send a nonempty string to replace it, or null to remove it (SPA only).

## Verification

npm run test:admin runs HTTP integration tests against a temporary SQLite database. It never uses the application's database.
