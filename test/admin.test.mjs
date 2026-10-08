import assert from "node:assert/strict";
import test from "node:test";
import { createIntegration } from "./support/integration.mjs";

test("admin API preserves strategy/config invariants and hides credentials", async (t) => {
	const { base, prisma } = await createIntegration(t, {
		afterMigration(db, migration) {
			if (migration === "20260916065907_init") {
				db.exec(
					"INSERT INTO Tenant (id,name,updatedAt) VALUES (1,'Test tenant',CURRENT_TIMESTAMP); INSERT INTO Application (id,code,name,updatedAt) VALUES (1,'test','Test app',CURRENT_TIMESTAMP); INSERT INTO TenantApplication (id,key,tenantId,applicationId,updatedAt) VALUES (1,'test',1,1,CURRENT_TIMESTAMP); INSERT INTO User (id,email,username,passwordHash,tenantId,updatedAt) VALUES (1,'user@example.test','user','fake-password-hash',1,CURRENT_TIMESTAMP); INSERT INTO TenantApplicationUser (id,tenantId,userId,tenantApplicationId,updatedAt) VALUES (1,1,1,1,CURRENT_TIMESTAMP); INSERT INTO Session (id,tokenHash,tenantApplicationUserId,expiresAt) VALUES (1,'fake-token-hash',1,'2099-01-01');",
				);
			}
			assert.equal(db.prepare("SELECT count(*) AS count FROM TenantApplicationUser").get().count, 1);
			assert.equal(db.prepare("SELECT count(*) AS count FROM Session").get().count, 1);
		},
	});
	async function request(path, method = "GET", body, status = 200) {
		const response = await fetch(base + path, {
			method,
			headers: { "Content-Type": "application/json" },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		const text = await response.text();
		assert.equal(response.status, status, text);
		assert.ok(!text.includes("fake-password-hash") && !text.includes("test-client-secret"));
		return text ? JSON.parse(text) : undefined;
	}
	const config = {
		name: "Test server",
		description: null,
		directoryTenantId: "11111111-1111-4111-8111-111111111111",
		clientId: "22222222-2222-4222-8222-222222222222",
		redirectUri: "http://localhost:3000/auth/microsoft/callback",
		scopes: "openid profile email",
	};
	const strategyPath = "/tenant-applications/1/strategies/";
	await t.test("invalid enablement and wrong config kind roll back", async () => {
		assert.equal((await request("/authentication-strategies")).length, 10);
		await request(strategyPath + "AZURE_SSO_SERVER", "PUT", { enabled: true }, 400);
		await request(strategyPath + "AZURE_SSO_SERVER", "PUT", { enabled: true, azureSsoConfig: config }, 400);
		await request(strategyPath + "EMAIL_PASSWORD", "PUT", { enabled: true, azureSsoConfig: config }, 400);
		await request(strategyPath + "UNKNOWN", "PUT", { enabled: true }, 400);
		assert.equal(await prisma.tenantApplicationAuthenticationStrategy.count(), 0);
		await request("/tenant-applications/999/strategies", "GET", undefined, 404);
	});
	let saved;
	let storedSecret;
	await t.test("create+enable stores the secret as entered and sanitizes every response", async () => {
		saved = await request(strategyPath + "AZURE_SSO_SERVER", "PUT", {
			enabled: true,
			azureSsoConfig: { ...config, clientSecret: "test-client-secret" },
		});
		assert.equal(saved.enabled, true);
		assert.equal(saved.azureSsoConfig.hasClientSecret, true);
		assert.equal("clientSecret" in saved.azureSsoConfig, false);
		storedSecret = (await prisma.azureSsoConfig.findUnique({ where: { id: saved.azureSsoConfig.id } })).clientSecret;
		assert.equal(storedSecret, "test-client-secret");
		for (const path of [
			"/azure-sso-configs",
			"/azure-sso-configs/" + saved.azureSsoConfig.id,
			"/tenant-applications/1/strategies",
			"/tenant-applications",
		]) {
			const body = JSON.stringify(await request(path));
			assert.ok(!body.includes(storedSecret) && !body.includes('"clientSecret"'));
		}
	});
	await t.test("editing preserves omitted secrets and rejects invalid/duplicate changes", async () => {
		await request("/azure-sso-configs/" + saved.azureSsoConfig.id, "PATCH", { ...config, name: "Renamed" });
		assert.equal(
			(await prisma.azureSsoConfig.findUnique({ where: { id: saved.azureSsoConfig.id } })).clientSecret,
			storedSecret,
		);
		await request("/azure-sso-configs/" + saved.azureSsoConfig.id, "PATCH", { ...config, clientSecret: null }, 400);
		await request(
			"/azure-sso-configs/" + saved.azureSsoConfig.id,
			"PATCH",
			{ ...config, redirectUri: "javascript:alert(1)" },
			400,
		);
		await request(
			"/azure-sso-configs",
			"POST",
			{ ...config, tenantApplicationId: 1, strategy: "AZURE_SSO_SERVER", clientSecret: "test-client-secret" },
			400,
		);
		await request("/azure-sso-configs/" + saved.azureSsoConfig.id, "PATCH", {
			...config,
			name: "Renamed",
			clientSecret: "replacement",
		});
		assert.equal(
			(await prisma.azureSsoConfig.findUnique({ where: { id: saved.azureSsoConfig.id } })).clientSecret,
			"replacement",
		);
	});
	await t.test("SPA accepts no secret; naming conflict rolls back enablement", async () => {
		await request(
			"/azure-sso-configs",
			"POST",
			{ ...config, name: "Renamed", tenantApplicationId: 1, strategy: "AZURE_SSO_CLIENT", enabled: true },
			409,
		);
		assert.equal(await prisma.tenantApplicationAuthenticationStrategy.count(), 1);
		const spa = await request(
			"/azure-sso-configs",
			"POST",
			{ ...config, name: "SPA", tenantApplicationId: 1, strategy: "AZURE_SSO_CLIENT", enabled: true },
			201,
		);
		assert.equal(spa.hasClientSecret, false);
		await request("/azure-sso-configs/" + spa.id, "PATCH", { ...config, name: "SPA", clientSecret: "temporary" });
		await request("/azure-sso-configs/" + spa.id, "PATCH", { ...config, name: "SPA", clientSecret: null });
		assert.equal((await request("/azure-sso-configs/" + spa.id)).hasClientSecret, false);
	});
	await t.test("deletion disables and preserves the strategy; recreation reuses it", async () => {
		await request("/azure-sso-configs/" + saved.azureSsoConfig.id, "DELETE", undefined, 204);
		const retained = await prisma.tenantApplicationAuthenticationStrategy.findUnique({ where: { id: saved.id } });
		assert.equal(retained.enabled, false);
		await request(strategyPath + "AZURE_SSO_SERVER", "PUT", { enabled: true }, 400);
		const recreated = await request(strategyPath + "AZURE_SSO_SERVER", "PUT", {
			enabled: true,
			azureSsoConfig: { ...config, clientSecret: "test-client-secret" },
		});
		assert.equal(recreated.id, saved.id);
	});
	await t.test("contact changes clear verification; TOTP response contains no secret or BigInt", async () => {
		await prisma.user.update({
			where: { id: 1 },
			data: { phoneNumber: "+306912345678", emailVerified: true, phoneVerified: true },
		});
		await prisma.totpAuthenticator.create({
			data: { userId: 1, encryptedSecret: "totp-secret-marker", lastUsedTimeStep: 123n, verified: true },
		});
		const users = await request("/users");
		assert.equal(users[0].totpAuthenticator.verified, true);
		assert.ok(!JSON.stringify(users).includes("totp-secret-marker"));
		const user = await request("/users/1", "PATCH", {
			email: "new@example.test",
			phoneNumber: "+306912345679",
			emailVerified: true,
			phoneVerified: true,
		});
		assert.equal(user.emailVerified, false);
		assert.equal(user.phoneVerified, false);
		await request("/users/1", "PATCH", { phoneNumber: null });
		await request("/users/1", "PATCH", { phoneVerified: true }, 400);
		await request("/users/1", "PATCH", { phoneNumber: "1234" }, 400);
	});
	await t.test("sign-in requires its exact enabled strategy; existing sessions survive disablement", async () => {
		const { hashPassword } = await import("../src/argon2/index.ts");
		const { signInWithEmail, signInWithUsername } = await import("../src/auth/signin.ts");
		await prisma.user.update({
			where: { id: 1 },
			data: { passwordHash: await hashPassword("TestPassword123!") },
		});
		await request(strategyPath + "AZURE_SSO_SERVER", "PUT", { enabled: false });
		await request(strategyPath + "AZURE_SSO_CLIENT", "PUT", { enabled: false });
		const emailInput = {
			email: "new@example.test",
			password: "TestPassword123!",
			tenantApplicationKey: "test",
		};
		const usernameInput = {
			username: "user",
			password: "TestPassword123!",
			tenantApplicationKey: "test",
		};
		await assert.rejects(signInWithEmail(emailInput), /strategy is not enabled/);
		assert.equal(await prisma.session.count(), 1);
		await request(strategyPath + "EMAIL_PASSWORD_EMAIL_OTP", "PUT", { enabled: true });
		await assert.rejects(signInWithEmail(emailInput), /strategy is not enabled/);
		await request(strategyPath + "EMAIL_PASSWORD", "PUT", { enabled: true });
		const session = await signInWithEmail(emailInput);
		assert.ok(session.session_token);
		assert.equal(await prisma.session.count(), 2);
		await assert.rejects(signInWithUsername(usernameInput), /strategy is not enabled/);
		await request(strategyPath + "EMAIL_PASSWORD", "PUT", { enabled: false });
		await assert.rejects(signInWithEmail(emailInput), /strategy is not enabled/);
		assert.equal(await prisma.session.count(), 2);
	});
});
