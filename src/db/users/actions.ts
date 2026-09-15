import prisma from "../prisma.js";

export type UpdateUserInput = {
	email?: string;
	username?: string;
	tenantId?: number;
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
		data: input,
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
