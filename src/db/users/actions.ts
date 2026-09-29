import { DatabaseRecordNotFoundError, DatabaseRelationError } from "../errors.js";
import prisma from "../prisma.js";

export type UpdateUserInput = {
	email?: string | undefined;
	username?: string | undefined;
	tenantId?: number | undefined;
	phoneNumber?: string | null | undefined;
	emailVerified?: boolean | undefined;
	phoneVerified?: boolean | undefined;
};

export async function createUser(
	email: string,
	username: string,
	passwordHash: string,
	tenantId: number,
	contact: Pick<UpdateUserInput, "phoneNumber" | "emailVerified" | "phoneVerified"> = {},
) {
	if (contact.phoneVerified && !contact.phoneNumber)
		throw new DatabaseRelationError("A verified phone requires a phone number");
	return prisma.user.create({
		data: {
			email,
			username,
			passwordHash,
			tenantId,
			phoneNumber: contact.phoneNumber ?? null,
			emailVerified: contact.emailVerified ?? false,
			phoneVerified: contact.phoneVerified ?? false,
		},
		omit: {
			passwordHash: true,
		},
	});
}

export async function updateUser(id: number, input: UpdateUserInput) {
	return prisma.$transaction(async (tx) => {
		const current = await tx.user.findUnique({ where: { id } });
		if (!current) throw new DatabaseRecordNotFoundError("User");
		const emailChanged = input.email !== undefined && input.email !== current.email;
		const phoneChanged = input.phoneNumber !== undefined && input.phoneNumber !== current.phoneNumber;
		const phoneNumber = input.phoneNumber === undefined ? current.phoneNumber : input.phoneNumber;
		const phoneVerified = phoneChanged ? false : (input.phoneVerified ?? current.phoneVerified);
		if (phoneVerified && !phoneNumber) throw new DatabaseRelationError("A verified phone requires a phone number");
		return tx.user.update({
			where: { id },
			data: {
				...(input.email === undefined ? {} : { email: input.email }),
				...(input.username === undefined ? {} : { username: input.username }),
				...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
				phoneNumber,
				emailVerified: emailChanged ? false : (input.emailVerified ?? current.emailVerified),
				phoneVerified,
			},
			omit: { passwordHash: true },
		});
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
