import prisma from "../prisma.js";

export async function createMembership(userId: number, tenantApplicationId: number) {
	return prisma.$transaction(async (tx) => {
		const [user, tenantApplication] = await Promise.all([
			tx.user.findUnique({
				where: { id: userId },
				select: { tenantId: true },
			}),
			tx.tenantApplication.findUnique({
				where: { id: tenantApplicationId },
				select: { tenantId: true },
			}),
		]);

		if (!user) {
			throw new Error("User not found");
		}

		if (!tenantApplication) {
			throw new Error("Tenant application not found");
		}

		if (user.tenantId !== tenantApplication.tenantId) {
			throw new Error("User and tenant application belong to different tenants");
		}

		return tx.tenantApplicationUser.create({
			data: {
				userId,
				tenantApplicationId,
			},
		});
	});
}

export async function deleteMembership(id: number) {
	return prisma.tenantApplicationUser.delete({
		where: { id },
	});
}
