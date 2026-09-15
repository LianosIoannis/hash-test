import prisma from "./prisma.js";

export async function createTenant(name: string, description?: string) {
	return prisma.tenant.create({
		data: {
			name,
			description: description ?? null,
		},
	});
}

export async function createApplication(code: string, name: string, description?: string) {
	return prisma.application.create({
		data: {
			code,
			name,
			description: description ?? null,
		},
	});
}

export async function createUser(email: string, username: string, passwordHash: string, tenantId: number) {
	return prisma.user.create({
		data: {
			email,
			username,
			passwordHash,
			tenantId,
		},
		omit: {
			passwordHash: true,
		},
	});
}

export async function createTenantApplication(tenantId: number, applicationId: number, key: string) {
	return prisma.tenantApplication.create({
		data: {
			tenantId,
			applicationId,
			key,
		},
	});
}

export async function createTenantApplicationUser(userId: number, tenantApplicationId: number) {
	return prisma.tenantApplicationUser.create({
		data: {
			userId,
			tenantApplicationId,
		},
	});
}

export async function createSession(tokenHash: string, tenantApplicationUserId: number, expiresAt: Date) {
	return prisma.session.create({
		data: {
			tokenHash,
			tenantApplicationUserId,
			expiresAt,
		},
	});
}
