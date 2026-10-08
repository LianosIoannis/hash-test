ALTER TABLE "TenantApplication" ADD COLUMN "sessionStrategy" TEXT NOT NULL DEFAULT 'JWT';
ALTER TABLE "Session" ADD COLUMN "strategy" TEXT;
