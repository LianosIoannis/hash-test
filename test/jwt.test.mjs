import assert from "node:assert/strict";
import test from "node:test";
import { decodeJwt } from "jose";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("JWT authentication through the consuming server", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	const tenant = fixtures.tenants[0];
	await fetch(`${integration.base}/tenant-applications/${tenant.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ enabled: true }),
	});
	const { createDemoApp } = await import("../src/demo/app.ts");
	const origin = await integration.startServer(
		createDemoApp({ centralUrl: integration.origin, tenantApplicationKey: tenant.tenantApplication.key }),
	);
	const response = await fetch(`${origin}/auth/signin`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
	});
	assert.equal(response.status, 200);
	const session = await response.json();
	assert.equal(session.mode, "JWT");
	assert.equal("session_token" in session, false);
	const identityResponse = await fetch(`${origin}/identity`, {
		headers: { Authorization: `Bearer ${session.jwt_token}` },
	});
	assert.equal(identityResponse.status, 200);
	const identity = await identityResponse.json();
	assert.deepEqual(identity, {
		userId: tenant.user.id,
		tenantId: tenant.tenant.id,
		tenantApplicationId: tenant.tenantApplication.id,
		membershipId: tenant.membership.id,
		sessionId: identity.sessionId,
	});
	assert.ok(Number.isInteger(identity.sessionId));
	const other = fixtures.tenants[1];
	const otherOrigin = await integration.startServer(
		createDemoApp({ centralUrl: integration.origin, tenantApplicationKey: other.tenantApplication.key }),
	);
	const access = (token, target = origin) =>
		fetch(`${target}/identity`, { headers: { Authorization: `Bearer ${token}` } });
	const signIn = (password = "IntegrationPassword123!") =>
		fetch(`${origin}/auth/signin`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "shared@example.test",
				password,
				tenantApplicationKey: other.tenantApplication.key,
			}),
		});
	await t.test("route configuration prevents cross-tenant access and sign-in redirection", async () => {
		assert.equal((await access(session.jwt_token, otherOrigin)).status, 401);
		const second = await (await signIn()).json();
		assert.equal((await (await access(second.jwt_token)).json()).tenantId, tenant.tenant.id);
		await fetch(`${integration.base}/tenant-applications/${other.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});
		const signedIn = await fetch(`${otherOrigin}/auth/signin`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
		});
		const otherSession = await signedIn.json();
		assert.equal(signedIn.status, 200);
		assert.equal((await (await access(otherSession.jwt_token, otherOrigin)).json()).userId, other.user.id);
		assert.equal((await access(otherSession.jwt_token)).status, 401);
	});
	await t.test("invalid credentials, missing memberships and disabled strategies create no session", async () => {
		const count = async () => (await (await fetch(`${integration.base}/sessions`)).json()).length;
		const initial = await count();
		assert.equal((await signIn("IncorrectPassword123!")).status, 401);
		await fetch(`${integration.base}/tenant-applications/${tenant.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: false }),
		});
		assert.equal((await signIn()).status, 401);
		assert.equal(await count(), initial);
		await fetch(`${integration.base}/tenant-applications/${tenant.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});
		await fetch(`${integration.base}/memberships/${tenant.membership.id}`, { method: "DELETE" });
		const afterRemoval = await count();
		assert.equal((await signIn()).status, 401);
		// Deleting the membership cascades its sessions; failed sign-ins add none.
		assert.equal(await count(), afterRemoval);
		await fetch(`${integration.base}/memberships`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId: tenant.user.id, tenantApplicationId: tenant.tenantApplication.id }),
		});
	});
	await t.test("tampered, opaque and centrally invalidated credentials are denied", async () => {
		const current = await (await signIn()).json();
		const currentIdentity = await (await access(current.jwt_token)).json();
		const parts = current.jwt_token.split(".");
		parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
		assert.equal((await access(parts.join("."))).status, 401);
		assert.equal((await access("opaque-session-token")).status, 401);
		await fetch(`${integration.base}/sessions/${currentIdentity.sessionId}`, { method: "DELETE" });
		assert.equal((await access(current.jwt_token)).status, 401);
	});
	await t.test("JWTs have a fixed two-hour expiry that requests do not extend", async (subtest) => {
		const current = await (await signIn()).json();
		const claims = decodeJwt(current.jwt_token);
		assert.equal(claims.exp - claims.iat, 7200);
		assert.equal(Date.parse(current.expiresAt), claims.exp * 1000);
		assert.equal((await access(current.jwt_token)).status, 200);
		const currentIdentity = await (await access(current.jwt_token)).json();
		await integration.prisma.session.update({
			where: { id: currentIdentity.sessionId },
			data: { expiresAt: new Date(0) },
		});
		assert.equal((await access(current.jwt_token)).status, 401);
		await integration.prisma.session.update({
			where: { id: currentIdentity.sessionId },
			data: { expiresAt: new Date(current.expiresAt) },
		});
		subtest.mock.timers.enable({ apis: ["Date"], now: claims.exp * 1000 });
		assert.equal((await access(current.jwt_token)).status, 401);
	});
	await t.test("legacy and wrong-mode sessions cannot authenticate", async () => {
		const current = await (await signIn()).json();
		const currentIdentity = await (await access(current.jwt_token)).json();
		// Persistence fixtures model pre-v1 and future-mode records; observe denial via HTTP.
		await integration.prisma.session.update({ where: { id: currentIdentity.sessionId }, data: { strategy: null } });
		assert.equal((await access(current.jwt_token)).status, 401);
		await integration.prisma.session.update({ where: { id: currentIdentity.sessionId }, data: { strategy: "COOKIE" } });
		assert.equal((await access(current.jwt_token)).status, 401);
		await integration.prisma.tenantApplication.update({
			where: { id: tenant.tenantApplication.id },
			data: { sessionStrategy: "COOKIE" },
		});
		await integration.prisma.session.update({ where: { id: currentIdentity.sessionId }, data: { strategy: "JWT" } });
		assert.equal((await access(current.jwt_token)).status, 401);
		assert.equal((await signIn()).status, 401);
		await integration.prisma.tenantApplication.update({
			where: { id: tenant.tenantApplication.id },
			data: { sessionStrategy: "JWT" },
		});
	});
	await t.test("central verification unavailability returns 503", async () => {
		const current = await (await signIn()).json();
		assert.equal((await access(current.jwt_token)).status, 200);
		await integration.stopServer(integration.origin);
		assert.equal((await access(current.jwt_token)).status, 503);
	});
});
