import prisma from "../prisma.js";

export async function findApplicationById(id: number) {
	return prisma.application.findUnique({
		where: { id },
		include: {
			_count: {
				select: { tenantApplications: true },
			},
		},
	});
}

export async function findApplications() {
	return prisma.application.findMany({
		include: {
			_count: {
				select: { tenantApplications: true },
			},
		},
		orderBy: { name: "asc" },
	});
}
