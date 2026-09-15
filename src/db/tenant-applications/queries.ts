import prisma from "../prisma.js";

const tenantApplicationDetails = {
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
	_count: {
		select: { users: true },
	},
} as const;

export async function findTenantApplicationById(id: number) {
	return prisma.tenantApplication.findUnique({
		where: { id },
		include: tenantApplicationDetails,
	});
}

export async function findTenantApplicationByKey(key: string) {
	return prisma.tenantApplication.findUnique({
		where: { key },
	});
}

export async function findTenantApplications(tenantId?: number) {
	return prisma.tenantApplication.findMany({
		...(tenantId === undefined ? {} : { where: { tenantId } }),
		include: tenantApplicationDetails,
		orderBy: { createdAt: "asc" },
	});
}
