import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("administrative mode changes permanently invalidate only the affected sessions", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	const tenant = fixtures.tenants[0];
	const { createDemoApp } = await import("../src/demo/app.ts");
	async function client(fixture, mode) {
		await fetch(`${integration.base}/tenant-applications/${fixture.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});
		const host = express();
		const origin = await integration.startServer(host);
		host.use(
			createDemoApp({
				centralUrl: integration.origin,
				tenantApplicationKey: fixture.tenantApplication.key,
				sessionMode: mode,
				publicOrigin: origin,
				allowInsecureCookies: true,
			}),
		);
		async function signIn() {
			let headers = { "Content-Type": "application/json" };
			if (mode === "COOKIE") {
				const csrf = await fetch(`${origin}/auth/csrf`);
				headers = {
					...headers,
					Origin: origin,
					Cookie: csrf.headers.getSetCookie()[0].split(";")[0],
					"X-CSRF-Token": (await csrf.json()).csrfToken,
				};
			}
			const response = await fetch(`${origin}/auth/signin`, {
				method: "POST",
				headers,
				body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
			});
			assert.equal(response.status, 200);
			const session = await response.json();
			assert.equal(session.mode, mode);
			return mode === "JWT"
				? { Authorization: `Bearer ${session.jwt_token}` }
				: { Cookie: response.headers.getSetCookie()[0].split(";")[0] };
		}
		return { signIn, access: (headers) => fetch(`${origin}/identity`, { headers }) };
	}
	const jwt = await client(tenant, "JWT");
	const cookie = await client(tenant, "COOKIE");
	const other = await client(fixtures.tenants[1], "JWT");
	const oldJwt = await jwt.signIn();
	const secondJwt = await jwt.signIn();
	const unaffected = await other.signIn();
	const legacy = await integration.prisma.session.create({
		data: {
			tokenHash: "legacy-mode-fixture",
			tenantApplicationUserId: tenant.membership.id,
			expiresAt: new Date(Date.now() + 7200000),
		},
	});
	const expired = await integration.prisma.session.create({
		data: {
			tokenHash: "expired-mode-fixture",
			tenantApplicationUserId: tenant.membership.id,
			expiresAt: new Date(0),
			strategy: "JWT",
		},
	});
	const change = (body) =>
		fetch(`${integration.base}/tenant-applications/${tenant.tenantApplication.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	const switched = await change({ sessionStrategy: "COOKIE" });
	assert.equal(switched.status, 200);
	assert.equal((await switched.json()).sessionStrategy, "COOKIE");
	assert.equal((await fetch(`${integration.base}/sessions/${legacy.id}`)).status, 404);
	assert.equal((await fetch(`${integration.base}/sessions/${expired.id}`)).status, 404);
	assert.equal((await jwt.access(oldJwt)).status, 401);
	assert.equal((await jwt.access(secondJwt)).status, 401);
	assert.equal((await other.access(unaffected)).status, 200);
	const oldCookie = await cookie.signIn();
	assert.equal((await cookie.access(oldCookie)).status, 200);
	assert.equal((await change({ sessionStrategy: "JWT" })).status, 200);
	assert.equal((await cookie.access(oldCookie)).status, 401);
	assert.equal((await jwt.access(oldJwt)).status, 401);
	assert.equal((await jwt.access(secondJwt)).status, 401);
	const freshJwt = await jwt.signIn();
	assert.equal((await jwt.access(freshJwt)).status, 200);
	assert.equal((await change({ sessionStrategy: "COOKIE" })).status, 200);
	assert.equal((await cookie.access(oldCookie)).status, 401);
	assert.equal((await other.access(unaffected)).status, 200);
	await t.test("unchanged and invalid saves preserve mode and sessions", async () => {
		const current = await cookie.signIn();
		assert.equal((await change({ sessionStrategy: "COOKIE" })).status, 200);
		assert.equal((await cookie.access(current)).status, 200);
		assert.equal((await change({ key: tenant.tenantApplication.key })).status, 200);
		assert.equal((await cookie.access(current)).status, 200);
		for (const body of [
			{},
			{ sessionStrategy: "BOTH" },
			{ sessionStrategy: null },
			{ sessionStrategy: ["JWT", "COOKIE"] },
			{ key: "", sessionStrategy: "JWT" },
		]) {
			assert.equal((await change(body)).status, 400);
			assert.equal((await cookie.access(current)).status, 200);
		}
		assert.equal(
			(await change({ key: fixtures.tenants[1].tenantApplication.key, sessionStrategy: "JWT" })).status,
			409,
		);
		assert.equal((await cookie.access(current)).status, 200);
		assert.equal(
			(await (await fetch(`${integration.base}/tenant-applications/${tenant.tenantApplication.id}`)).json())
				.sessionStrategy,
			"COOKIE",
		);
	});
	await t.test("creation accepts exactly one mode and defaults to JWT", async () => {
		const applicationResponse = await fetch(`${integration.base}/applications`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "mode-creation", name: "Mode creation" }),
		});
		assert.equal(applicationResponse.status, 201);
		const application = await applicationResponse.json();
		const create = (body) =>
			fetch(`${integration.base}/tenant-applications`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					tenantId: tenant.tenant.id,
					applicationId: application.id,
					key: "invalid-mode",
					...body,
				}),
			});
		assert.equal((await create({ sessionStrategy: "BOTH" })).status, 400);
		const defaultMode = await create({ key: "default-mode" });
		assert.equal(defaultMode.status, 201);
		assert.equal((await defaultMode.json()).sessionStrategy, "JWT");
		const cookieCreation = await create({
			tenantId: fixtures.tenants[1].tenant.id,
			key: "cookie-creation",
			sessionStrategy: "COOKIE",
		});
		assert.equal(cookieCreation.status, 201);
		assert.equal((await cookieCreation.json()).sessionStrategy, "COOKIE");
	});
	await t.test("overlapping sign-ins cannot issue the old requested mode after switching", async () => {
		assert.equal((await change({ sessionStrategy: "JWT" })).status, 200);
		const pending = Array.from({ length: 8 }, () =>
			fetch(`${integration.origin}/api/auth/signin`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "shared@example.test",
					password: "IntegrationPassword123!",
					tenantApplicationKey: tenant.tenantApplication.key,
					mode: "JWT",
				}),
			}),
		);
		await delay(10);
		assert.equal((await change({ sessionStrategy: "COOKIE" })).status, 200);
		const tokens = [];
		for (const response of await Promise.all(pending)) {
			assert.ok([200, 401].includes(response.status));
			if (response.status === 200) {
				const session = await response.json();
				assert.equal(session.mode, "JWT");
				tokens.push({ Authorization: `Bearer ${session.jwt_token}` });
			}
		}
		for (const token of tokens) assert.equal((await jwt.access(token)).status, 401);
		assert.equal((await change({ sessionStrategy: "JWT" })).status, 200);
		for (const token of tokens) assert.equal((await jwt.access(token)).status, 401);
		assert.equal((await other.access(unaffected)).status, 200);
	});
});
