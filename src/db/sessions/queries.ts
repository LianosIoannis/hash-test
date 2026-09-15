import prisma from "../prisma.js";

const safeSessionFields = {
	id: true,
	tenantApplicationUserId: true,
	createdAt: true,
	expiresAt: true,
	tenantApplicationUser: {
		select: {
			user: {
				select: {
					id: true,
					email: true,
					username: true,
				},
			},
			tenantApplication: {
				select: {
					id: true,
					key: true,
					application: {
						select: {
							id: true,
							code: true,
							name: true,
						},
					},
				},
			},
		},
	},
} as const;

export async function findSessionById(id: number) {
	return prisma.session.findUnique({
		where: { id },
		select: safeSessionFields,
	});
}

export async function findSessionByTokenHash(tokenHash: string) {
	return prisma.session.findUnique({
		where: { tokenHash },
	});
}

export async function findSessions() {
	return prisma.session.findMany({
		select: safeSessionFields,
		orderBy: { createdAt: "desc" },
	});
}
