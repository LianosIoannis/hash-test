import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("cookie authentication through the consuming server", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	const tenant = fixtures.tenants[1];
	await integration.prisma.tenantApplication.update({
		where: { id: tenant.tenantApplication.id },
		data: { sessionStrategy: "COOKIE" },
	});
	await fetch(`${integration.base}/tenant-applications/${tenant.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ enabled: true }),
	});
	const { createDemoApp } = await import("../src/demo/app.ts");
	const host = express();
	const origin = await integration.startServer(host);
	host.use(
		createDemoApp({
			centralUrl: integration.origin,
			tenantApplicationKey: tenant.tenantApplication.key,
			sessionMode: "COOKIE",
			publicOrigin: origin,
			allowInsecureCookies: true,
		}),
	);
	const bootstrap = await fetch(`${origin}/auth/csrf`);
	assert.equal(bootstrap.status, 200);
	const csrfCookie = bootstrap.headers.getSetCookie()[0].split(";")[0];
	const { csrfToken } = await bootstrap.json();
	const signinStarted = Date.now();
	const response = await fetch(`${origin}/auth/signin`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: csrfCookie, Origin: origin, "X-CSRF-Token": csrfToken },
		body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
	});
	assert.equal(response.status, 200);
	const signinFinished = Date.now();
	const session = await response.json();
	assert.deepEqual(Object.keys(session).sort(), ["expiresAt", "mode"]);
	assert.equal(session.mode, "COOKIE");
	const cookieHeader = response.headers.getSetCookie()[0];
	assert.match(cookieHeader, /HttpOnly/);
	assert.match(cookieHeader, /SameSite=Lax/);
	assert.match(cookieHeader, /Path=\//);
	assert.doesNotMatch(cookieHeader, /Domain=/i);
	const cookie = cookieHeader.split(";")[0];
	const identityResponse = await fetch(`${origin}/identity`, { headers: { Cookie: cookie } });
	assert.equal(identityResponse.status, 200);
	const identity = await identityResponse.json();
	assert.equal(identity.membershipId, tenant.membership.id);
	await t.test("expiry is fixed and every request checks central session validity", async (subtest) => {
		const access = () => fetch(`${origin}/identity`, { headers: { Cookie: cookie } });
		assert.ok(Date.parse(session.expiresAt) >= signinStarted + 7199000);
		assert.ok(Date.parse(session.expiresAt) <= signinFinished + 7200000);
		assert.equal((await access()).status, 200);
		subtest.mock.timers.enable({ apis: ["Date"], now: Date.parse(session.expiresAt) });
		assert.equal((await access()).status, 401);
		subtest.mock.timers.reset();
		assert.equal((await access()).status, 200);
	});
	await t.test("cookie verification needs no JWT secret and accepts no alternate mode", async () => {
		const secret = process.env.JWT_SECRET;
		delete process.env.JWT_SECRET;
		try {
			assert.equal((await fetch(`${origin}/identity`, { headers: { Cookie: cookie } })).status, 200);
			const fresh = await fetch(`${origin}/auth/signin`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: csrfCookie, Origin: origin, "X-CSRF-Token": csrfToken },
				body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
			});
			assert.equal(fresh.status, 200);
		} finally {
			process.env.JWT_SECRET = secret;
		}
		const other = fixtures.tenants[0];
		host.use(
			"/jwt",
			createDemoApp({ centralUrl: integration.origin, tenantApplicationKey: other.tenantApplication.key }),
		);
		const otherOrigin = `${origin}/jwt`;
		await fetch(`${integration.base}/tenant-applications/${other.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});
		const jwtResponse = await fetch(`${otherOrigin}/auth/signin`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
		});
		assert.equal(jwtResponse.status, 200);
		const jwt = await jwtResponse.json();
		assert.equal(
			(await fetch(`${otherOrigin}/identity`, { headers: { Authorization: `Bearer ${jwt.jwt_token}` } })).status,
			200,
		);
		const forgedCookie = `${cookie.slice(0, cookie.indexOf("=") + 1)}${jwt.jwt_token}`;
		assert.equal((await fetch(`${origin}/identity`, { headers: { Cookie: forgedCookie } })).status, 401);
		const token = cookie.slice(cookie.indexOf("=") + 1);
		assert.equal(
			(await fetch(`${otherOrigin}/identity`, { headers: { Authorization: `Bearer ${token}`, Cookie: cookie } }))
				.status,
			401,
		);
		assert.equal((await fetch(`${origin}/identity`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
		const verify = (key, mode) =>
			fetch(`${integration.origin}/api/auth/verify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, tenantApplicationKey: key, mode }),
			});
		assert.equal((await verify(other.tenantApplication.key, "COOKIE")).status, 401);
		assert.equal((await verify(tenant.tenantApplication.key, "JWT")).status, 401);
		assert.equal((await (await fetch(`${integration.base}/sessions`)).text()).includes(token), false);
		await integration.prisma.tenantApplication.update({
			where: { id: tenant.tenantApplication.id },
			data: { sessionStrategy: "JWT" },
		});
		assert.equal((await fetch(`${origin}/identity`, { headers: { Cookie: cookie } })).status, 401);
		await integration.prisma.tenantApplication.update({
			where: { id: tenant.tenantApplication.id },
			data: { sessionStrategy: "COOKIE" },
		});
	});
	await t.test("CSRF rejection creates no sessions and makes no protected state changes", async () => {
		const sessionCount = async () => (await (await fetch(`${integration.base}/sessions`)).json()).length;
		const count = await sessionCount();
		const proofs = [
			{},
			{ Origin: origin },
			{ Origin: "http://attacker.test", "X-CSRF-Token": csrfToken },
			{ "X-CSRF-Token": csrfToken },
			{ Origin: origin, "X-CSRF-Token": `${"a".repeat(43)}.${"b".repeat(43)}` },
			{ Origin: origin, "X-CSRF-Token": "invalid" },
		];
		for (const proof of proofs) {
			const headers = { Cookie: `${cookie}; ${csrfCookie}`, "Content-Type": "application/json", ...proof };
			assert.equal(
				(
					await fetch(`${origin}/auth/signin`, {
						method: "POST",
						headers,
						body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
					})
				).status,
				403,
			);
			assert.equal((await fetch(`${origin}/mutation`, { method: "POST", headers })).status, 403);
		}
		assert.equal(await sessionCount(), count);
		assert.deepEqual(await (await fetch(`${origin}/mutation`, { headers: { Cookie: cookie } })).json(), { value: 0 });
		const headers = { Cookie: `${cookie}; ${csrfCookie}`, Origin: origin, "X-CSRF-Token": csrfToken };
		assert.deepEqual(await (await fetch(`${origin}/mutation`, { method: "POST", headers })).json(), { value: 1 });
		const fresh = await fetch(`${origin}/auth/csrf`);
		const newCookie = fresh.headers.getSetCookie()[0].split(";")[0];
		assert.equal(
			(
				await fetch(`${origin}/mutation`, {
					method: "POST",
					headers: { ...headers, Cookie: `${cookie}; ${newCookie}` },
				})
			).status,
			403,
		);
	});
	await t.test("central invalidation and outage cannot reach protected handlers", async () => {
		await fetch(`${integration.base}/sessions/${identity.sessionId}`, { method: "DELETE" });
		assert.equal((await fetch(`${origin}/identity`, { headers: { Cookie: cookie } })).status, 401);
		await integration.stopServer(integration.origin);
		assert.equal((await fetch(`${origin}/identity`, { headers: { Cookie: cookie } })).status, 503);
	});
});
