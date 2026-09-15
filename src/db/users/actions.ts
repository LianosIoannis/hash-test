import prisma from "../prisma.js";

export type UpdateUserInput = {
	email?: string | undefined;
	username?: string | undefined;
	tenantId?: number | undefined;
};

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

export async function updateUser(id: number, input: UpdateUserInput) {
	return prisma.user.update({
		where: { id },
		data: {
			...(input.email === undefined ? {} : { email: input.email }),
			...(input.username === undefined ? {} : { username: input.username }),
			...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
		},
		omit: { passwordHash: true },
	});
}

export async function updateUserPasswordHash(id: number, passwordHash: string) {
	return prisma.user.update({
		where: { id },
		data: { passwordHash },
		omit: { passwordHash: true },
	});
}

export async function deleteUser(id: number) {
	return prisma.user.delete({
		where: { id },
		omit: { passwordHash: true },
	});
}
