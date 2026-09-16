import { DatabaseRecordNotFoundError, DatabaseRelationError } from "../errors.js";
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
			throw new DatabaseRecordNotFoundError("User");
		}

		if (!tenantApplication) {
			throw new DatabaseRecordNotFoundError("Tenant application");
		}

		if (user.tenantId !== tenantApplication.tenantId) {
			throw new DatabaseRelationError("User and tenant application belong to different tenants");
		}

		return tx.tenantApplicationUser.create({
			data: {
				userId,
				tenantApplicationId,
				tenantId: user.tenantId,
			},
		});
	});
}

export async function deleteMembership(id: number) {
	return prisma.tenantApplicationUser.delete({
		where: { id },
	});
}
