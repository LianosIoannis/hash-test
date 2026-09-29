-- Preserve existing users, memberships and sessions while adding contact fields.
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_tenantId_phoneNumber_key" ON "User"("tenantId", "phoneNumber");

CREATE TABLE "TenantApplicationAuthenticationStrategy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tenantApplicationId" INTEGER NOT NULL,
    "strategy" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantApplicationAuthenticationStrategy_tenantApplicationId_fkey" FOREIGN KEY ("tenantApplicationId") REFERENCES "TenantApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TenantApplicationAuthenticationStrategy_tenantApplicationId_idx" ON "TenantApplicationAuthenticationStrategy"("tenantApplicationId");
CREATE UNIQUE INDEX "TenantApplicationAuthenticationStrategy_tenantApplicationId_strategy_key" ON "TenantApplicationAuthenticationStrategy"("tenantApplicationId", "strategy");

CREATE TABLE "TotpAuthenticator" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "label" TEXT,
    "encryptedSecret" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedTimeStep" BIGINT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TotpAuthenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TotpAuthenticator_userId_key" ON "TotpAuthenticator"("userId");

CREATE TABLE "AzureSsoConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tenantApplicationStrategyId" INTEGER NOT NULL,
    "directoryTenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'openid profile email',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AzureSsoConfig_tenantApplicationStrategyId_fkey" FOREIGN KEY ("tenantApplicationStrategyId") REFERENCES "TenantApplicationAuthenticationStrategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AzureSsoConfig_name_key" ON "AzureSsoConfig"("name");
CREATE UNIQUE INDEX "AzureSsoConfig_tenantApplicationStrategyId_key" ON "AzureSsoConfig"("tenantApplicationStrategyId");
