import type { SessionStrategy } from "../../generated/prisma/enums.js";
import prisma from "../prisma.js";

export type UpdateTenantApplicationInput = {
	key?: string;
	tenantId?: number;
	applicationId?: number;
	sessionStrategy?: SessionStrategy;
};

export async function createTenantApplication(
	tenantId: number,
	applicationId: number,
	key: string,
	sessionStrategy: SessionStrategy = "JWT",
) {
	return prisma.tenantApplication.create({
		data: {
			tenantId,
			applicationId,
			key,
			sessionStrategy,
		},
	});
}

export async function updateTenantApplication(id: number, input: UpdateTenantApplicationInput) {
	return prisma.$transaction(
		async (tx) => {
			const current = await tx.tenantApplication.findUniqueOrThrow({ where: { id } });
			const updated = await tx.tenantApplication.update({ where: { id }, data: input });
			if (input.sessionStrategy !== undefined && current.sessionStrategy !== input.sessionStrategy) {
				await tx.session.deleteMany({ where: { tenantApplicationUser: { tenantApplicationId: id } } });
			}
			return updated;
		},
		{ isolationLevel: "Serializable" },
	);
}

export async function deleteTenantApplication(id: number) {
	return prisma.tenantApplication.delete({
		where: { id },
	});
}
