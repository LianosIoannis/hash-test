/*
  Warnings:

  - Added the required column `updatedAt` to the `TenantApplication` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TenantApplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenantApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenantApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TenantApplication" ("applicationId", "id", "key", "tenantId") SELECT "applicationId", "id", "key", "tenantId" FROM "TenantApplication";
DROP TABLE "TenantApplication";
ALTER TABLE "new_TenantApplication" RENAME TO "TenantApplication";
CREATE UNIQUE INDEX "TenantApplication_key_key" ON "TenantApplication"("key");
CREATE INDEX "TenantApplication_applicationId_idx" ON "TenantApplication"("applicationId");
CREATE UNIQUE INDEX "TenantApplication_tenantId_applicationId_key" ON "TenantApplication"("tenantId", "applicationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
