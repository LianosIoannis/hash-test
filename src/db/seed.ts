import { hashPassword } from "../argon2/index.js";
import prisma from "./prisma.js";

const TEST_PASSWORD = "TestPassword123!";

async function seed() {
	const passwordHash = await hashPassword(TEST_PASSWORD);

	const result = await prisma.$transaction(async (tx) => {
		const accounting = await tx.application.upsert({
			where: { code: "accounting" },
			update: {
				name: "Accounting",
				description: "Test accounting application",
			},
			create: {
				code: "accounting",
				name: "Accounting",
				description: "Test accounting application",
			},
		});

		const reporting = await tx.application.upsert({
			where: { code: "reporting" },
			update: {
				name: "Reporting",
				description: "Test reporting application",
			},
			create: {
				code: "reporting",
				name: "Reporting",
				description: "Test reporting application",
			},
		});

		const acme = await tx.tenant.upsert({
			where: { name: "Acme" },
			update: { description: "Primary test tenant" },
			create: {
				name: "Acme",
				description: "Primary test tenant",
			},
		});

		const globex = await tx.tenant.upsert({
			where: { name: "Globex" },
			update: { description: "Secondary test tenant" },
			create: {
				name: "Globex",
				description: "Secondary test tenant",
			},
		});

		const acmeAccounting = await tx.tenantApplication.upsert({
			where: { key: "acme-accounting" },
			update: {
				tenantId: acme.id,
				applicationId: accounting.id,
			},
			create: {
				key: "acme-accounting",
				tenantId: acme.id,
				applicationId: accounting.id,
			},
		});

		const acmeReporting = await tx.tenantApplication.upsert({
			where: { key: "acme-reporting" },
			update: {
				tenantId: acme.id,
				applicationId: reporting.id,
			},
			create: {
				key: "acme-reporting",
				tenantId: acme.id,
				applicationId: reporting.id,
			},
		});

		const globexAccounting = await tx.tenantApplication.upsert({
			where: { key: "globex-accounting" },
			update: {
				tenantId: globex.id,
				applicationId: accounting.id,
			},
			create: {
				key: "globex-accounting",
				tenantId: globex.id,
				applicationId: accounting.id,
			},
		});

		const acmeAdmin = await tx.user.upsert({
			where: {
				tenantId_email: {
					tenantId: acme.id,
					email: "admin@example.test",
				},
			},
			update: {
				username: "admin",
				passwordHash,
			},
			create: {
				email: "admin@example.test",
				username: "admin",
				passwordHash,
				tenantId: acme.id,
			},
		});

		const acmeAnalyst = await tx.user.upsert({
			where: {
				tenantId_email: {
					tenantId: acme.id,
					email: "analyst@acme.test",
				},
			},
			update: {
				username: "analyst",
				passwordHash,
			},
			create: {
				email: "analyst@acme.test",
				username: "analyst",
				passwordHash,
				tenantId: acme.id,
			},
		});

		const globexAdmin = await tx.user.upsert({
			where: {
				tenantId_email: {
					tenantId: globex.id,
					email: "admin@example.test",
				},
			},
			update: {
				username: "admin",
				passwordHash,
			},
			create: {
				email: "admin@example.test",
				username: "admin",
				passwordHash,
				tenantId: globex.id,
			},
		});

		const memberships = [
			[acmeAdmin.id, acmeAccounting.id],
			[acmeAdmin.id, acmeReporting.id],
			[acmeAnalyst.id, acmeReporting.id],
			[globexAdmin.id, globexAccounting.id],
		] as const;

		for (const [userId, tenantApplicationId] of memberships) {
			await tx.tenantApplicationUser.upsert({
				where: {
					userId_tenantApplicationId: {
						userId,
						tenantApplicationId,
					},
				},
				update: {},
				create: {
					userId,
					tenantApplicationId,
				},
			});
		}

		return {
			applications: 2,
			tenants: 2,
			tenantApplications: 3,
			users: 3,
			memberships: memberships.length,
		};
	});

	console.log("Database seed completed:", result);
	console.log(`Test users use password: ${TEST_PASSWORD}`);
	console.log("No session records were created or modified.");
}

try {
	await seed();
} finally {
	await prisma.$disconnect();
}
