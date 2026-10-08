import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const migrationDirectory = fileURLToPath(new URL("../../prisma/migrations/", import.meta.url));
let initialized = false;

// Prisma is a module singleton: each test file must use one fixture, with Node's
// default test-file process isolation. Never import application code beforehand.
export async function createIntegration(t, { afterMigration } = {}) {
	if (initialized) throw new Error("Use one integration fixture per test process");
	initialized = true;
	const tempRoot = resolve(tmpdir());
	const directory = mkdtempSync(join(tempRoot, "hash-test-integration-"));
	const previousEnvironment = {
		DATABASE_URL: process.env.DATABASE_URL,
		JWT_SECRET: process.env.JWT_SECRET,
		SSO_SECRET_ENCRYPTION_KEY: process.env.SSO_SECRET_ENCRYPTION_KEY,
	};
	process.env.DATABASE_URL = `file:${join(directory, "integration.db").replaceAll("\\", "/")}`;
	process.env.JWT_SECRET = "integration-only-jwt-secret-not-for-production";
	delete process.env.SSO_SECRET_ENCRYPTION_KEY;
	const servers = [];
	let prisma;
	let db;
	t.after(async () => {
		const errors = [];
		for (const server of servers.toReversed()) {
			if (!server.listening) continue;
			try {
				await new Promise((resolveClose, reject) => {
					server.close((error) => (error ? reject(error) : resolveClose()));
					server.closeAllConnections();
				});
			} catch (error) {
				errors.push(error);
			}
		}
		try {
			await prisma?.$disconnect();
		} catch (error) {
			errors.push(error);
		}
		try {
			if (db?.open) db.close();
		} catch (error) {
			errors.push(error);
		}
		for (const [key, value] of Object.entries(previousEnvironment)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		try {
			const target = resolve(directory);
			if (dirname(target) !== tempRoot || !target.startsWith(join(tempRoot, "hash-test-integration-"))) {
				throw new Error("Unexpected integration cleanup path");
			}
			rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
		} catch (error) {
			errors.push(error);
		}
		if (errors.length) throw new AggregateError(errors, "Integration cleanup failed");
	});
	db = new Database(join(directory, "integration.db"));
	db.pragma("foreign_keys = ON");
	const migrations = readdirSync(migrationDirectory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	for (const migration of migrations) {
		db.exec(readFileSync(join(migrationDirectory, migration, "migration.sql"), "utf8"));
		afterMigration?.(db, migration);
	}
	if (db.pragma("foreign_key_check").length) throw new Error("Migration fixtures violate foreign keys");
	db.close();
	({ default: prisma } = await import("../../src/db/prisma.ts"));
	const { createApp } = await import("../../src/server/app.ts");
	async function startServer(app, { protocol = "http:" } = {}) {
		const server = app.listen(0, "127.0.0.1");
		servers.push(server);
		await once(server, "listening");
		return `${protocol}//127.0.0.1:${server.address().port}`;
	}
	const origin = await startServer(createApp());
	async function stopServer(origin) {
		const port = Number(new URL(origin).port);
		const server = servers.find((candidate) => candidate.listening && candidate.address().port === port);
		if (!server) throw new Error("No fixture server matches this origin");
		await new Promise((resolveClose, reject) => {
			server.close((error) => (error ? reject(error) : resolveClose()));
			server.closeAllConnections();
		});
	}
	return { base: `${origin}/api`, origin, directory, prisma, startServer, stopServer };
}

export async function seedTenantFixtures(base) {
	async function create(path, input) {
		const response = await fetch(`${base}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		});
		if (response.status !== 201) throw new Error(`Fixture creation failed: ${path} (${response.status})`);
		return response.json();
	}
	const application = await create("/applications", { code: "integration", name: "Integration application" });
	const tenants = [];
	for (const name of ["Tenant A", "Tenant B"]) {
		const tenant = await create("/tenants", { name });
		const tenantApplication = await create("/tenant-applications", {
			tenantId: tenant.id,
			applicationId: application.id,
			key: `integration-${tenant.id}`,
		});
		const user = await create("/users", {
			tenantId: tenant.id,
			email: "shared@example.test",
			username: "shared-user",
			password: "IntegrationPassword123!",
		});
		const membership = await create("/memberships", { userId: user.id, tenantApplicationId: tenantApplication.id });
		tenants.push({ tenant, tenantApplication, user, membership });
	}
	return { application, tenants };
}
