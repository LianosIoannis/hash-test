import prisma from "../prisma.js";

export type UpdateTenantInput = {
	name?: string;
	description?: string | null;
};

export async function createTenant(name: string, description?: string) {
	return prisma.tenant.create({
		data: {
			name,
			description: description ?? null,
		},
	});
}

export async function updateTenant(id: number, input: UpdateTenantInput) {
	return prisma.tenant.update({
		where: { id },
		data: input,
	});
}

export async function deleteTenant(id: number) {
	return prisma.tenant.delete({
		where: { id },
	});
}
