import prisma from "../prisma.js";

export async function findTenantById(id: number) {
	return prisma.tenant.findUnique({
		where: { id },
		include: {
			_count: {
				select: {
					tenantApplications: true,
					users: true,
				},
			},
		},
	});
}

export async function findTenants() {
	return prisma.tenant.findMany({
		include: {
			_count: {
				select: {
					tenantApplications: true,
					users: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});
}
