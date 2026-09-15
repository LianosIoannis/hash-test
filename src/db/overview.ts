import prisma from "./prisma.js";

export async function getDatabaseOverview() {
	const now = new Date();

	const [tenants, applications, tenantApplications, users, memberships, activeSessions, expiredSessions] =
		await prisma.$transaction([
			prisma.tenant.count(),
			prisma.application.count(),
			prisma.tenantApplication.count(),
			prisma.user.count(),
			prisma.tenantApplicationUser.count(),
			prisma.session.count({ where: { expiresAt: { gt: now } } }),
			prisma.session.count({ where: { expiresAt: { lte: now } } }),
		]);

	return {
		tenants,
		applications,
		tenantApplications,
		users,
		memberships,
		activeSessions,
		expiredSessions,
	};
}
