import prisma from "../prisma.js";

const membershipDetails = {
	user: {
		select: {
			id: true,
			email: true,
			username: true,
			tenantId: true,
		},
	},
	tenantApplication: {
		include: {
			tenant: {
				select: {
					id: true,
					name: true,
				},
			},
			application: {
				select: {
					id: true,
					code: true,
					name: true,
				},
			},
		},
	},
	_count: {
		select: { sessions: true },
	},
} as const;

export async function findMembershipById(id: number) {
	return prisma.tenantApplicationUser.findUnique({
		where: { id },
		include: membershipDetails,
	});
}

export async function findTenantApplicationUser(userId: number, tenantApplicationKey: string) {
	return prisma.tenantApplicationUser.findFirst({
		where: {
			userId,
			tenantApplication: {
				key: tenantApplicationKey,
			},
		},
	});
}

export async function findMemberships() {
	return prisma.tenantApplicationUser.findMany({
		include: membershipDetails,
		orderBy: { createdAt: "asc" },
	});
}

export async function findTenantApplicationUsers(tenantApplicationId: number) {
	return prisma.tenantApplicationUser.findMany({
		where: { tenantApplicationId },
		include: membershipDetails,
		orderBy: { createdAt: "asc" },
	});
}

export async function findUserApplications(userId: number) {
	return prisma.tenantApplicationUser.findMany({
		where: { userId },
		include: membershipDetails,
		orderBy: { createdAt: "asc" },
	});
}
