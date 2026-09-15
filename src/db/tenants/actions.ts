import prisma from "../prisma.js";

export type UpdateTenantInput = {
	name?: string | undefined;
	description?: string | null | undefined;
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
		data: {
			...(input.name === undefined ? {} : { name: input.name }),
			...(input.description === undefined ? {} : { description: input.description }),
		},
	});
}

export async function deleteTenant(id: number) {
	return prisma.tenant.delete({
		where: { id },
	});
}
