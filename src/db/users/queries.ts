import prisma from "../prisma.js";

const safeUserFields = {
	id: true,
	email: true,
	username: true,
	tenantId: true,
	createdAt: true,
	updatedAt: true,
} as const;

export async function findUserById(id: number) {
	return prisma.user.findUnique({
		where: { id },
		select: {
			...safeUserFields,
			tenant: {
				select: {
					id: true,
					name: true,
				},
			},
			_count: {
				select: { applications: true },
			},
		},
	});
}

export async function findUserByEmail(email: string, tenantId: number) {
	return prisma.user.findUnique({
		where: {
			tenantId_email: {
				tenantId,
				email,
			},
		},
	});
}

export async function findUserByUsername(username: string, tenantId: number) {
	return prisma.user.findUnique({
		where: {
			tenantId_username: {
				tenantId,
				username,
			},
		},
	});
}

export async function findUsers(tenantId?: number) {
	return prisma.user.findMany({
		...(tenantId === undefined ? {} : { where: { tenantId } }),
		select: {
			...safeUserFields,
			tenant: {
				select: {
					id: true,
					name: true,
				},
			},
			_count: {
				select: { applications: true },
			},
		},
		orderBy: [{ tenantId: "asc" }, { email: "asc" }],
	});
}

export async function findTenantUsers(tenantId: number) {
	return findUsers(tenantId);
}
