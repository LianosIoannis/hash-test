import prisma from "../prisma.js";

export type UpdateTenantApplicationInput = {
	key?: string;
	tenantId?: number;
	applicationId?: number;
};

export async function createTenantApplication(tenantId: number, applicationId: number, key: string) {
	return prisma.tenantApplication.create({
		data: {
			tenantId,
			applicationId,
			key,
		},
	});
}

export async function updateTenantApplication(id: number, input: UpdateTenantApplicationInput) {
	return prisma.tenantApplication.update({
		where: { id },
		data: input,
	});
}

export async function deleteTenantApplication(id: number) {
	return prisma.tenantApplication.delete({
		where: { id },
	});
}
