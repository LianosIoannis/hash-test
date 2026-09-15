import prisma from "./prisma.js";

export async function findUserByEmail(email: string, tenantId: number) {
	return prisma.user.findUnique({
		where: {
			tenantId_email: {
				tenantId,
				email,
			},
		},
	});
}

export async function findUserByUsername(username: string, tenantId: number) {
	return prisma.user.findUnique({
		where: {
			tenantId_username: {
				tenantId,
				username,
			},
		},
	});
}

export async function findTenantApplicationByKey(key: string) {
	return prisma.tenantApplication.findUnique({
		where: { key },
	});
}

export async function findTenantApplicationUser(userId: number, tenantApplicationKey: string) {
	const tenantApplication = await findTenantApplicationByKey(tenantApplicationKey);

	if (!tenantApplication) {
		return null;
	}

	return prisma.tenantApplicationUser.findUnique({
		where: {
			userId_tenantApplicationId: {
				userId,
				tenantApplicationId: tenantApplication.id,
			},
		},
	});
}

export async function findSessionByTokenHash(tokenHash: string) {
	return prisma.session.findUnique({
		where: { tokenHash },
	});
}

export async function findTenantUsers(tenantId: number) {
	return prisma.user.findMany({
		where: { tenantId },
	});
}

export async function findTenantApplications(tenantId: number) {
	return prisma.tenantApplication.findMany({
		where: { tenantId },
	});
}

export async function findTenants() {
	return prisma.tenant.findMany();
}
