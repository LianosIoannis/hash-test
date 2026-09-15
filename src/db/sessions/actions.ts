import prisma from "../prisma.js";

export async function createSession(tokenHash: string, tenantApplicationUserId: number, expiresAt: Date) {
	return prisma.session.create({
		data: {
			tokenHash,
			tenantApplicationUserId,
			expiresAt,
		},
	});
}

export async function deleteSession(id: number) {
	return prisma.session.delete({
		where: { id },
	});
}

export async function deleteUserSessions(userId: number) {
	return prisma.session.deleteMany({
		where: {
			tenantApplicationUser: { userId },
		},
	});
}

export async function deleteExpiredSessions(now = new Date()) {
	return prisma.session.deleteMany({
		where: {
			expiresAt: { lte: now },
		},
	});
}
