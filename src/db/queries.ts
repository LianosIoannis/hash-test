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
