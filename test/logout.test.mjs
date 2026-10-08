import assert from "node:assert/strict";
import test from "node:test";
import { startDemoFixture } from "./support/demo.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("logout invalidates only the current session in either mode", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	const clients = [];
	for (const [index, mode] of ["JWT", "COOKIE"].entries()) {
		const tenant = fixtures.tenants[index];
		const origin = await startDemoFixture(integration, tenant, mode);
		let csrf = {};
		if (mode === "COOKIE") {
			const response = await fetch(`${origin}/auth/csrf`);
			csrf = {
				Cookie: response.headers.getSetCookie()[0].split(";")[0],
				Origin: origin,
				"X-CSRF-Token": (await response.json()).csrfToken,
			};
		}
		const signIn = async () => {
			const response = await fetch(`${origin}/auth/signin`, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...csrf },
				body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
			});
			assert.equal(response.status, 200);
			const session = await response.json();
			const credential =
				mode === "JWT"
					? { Authorization: `Bearer ${session.jwt_token}` }
					: { Cookie: response.headers.getSetCookie()[0].split(";")[0] };
			return { credential, session };
		};
		const current = await signIn();
		const other = await signIn();
		clients.push({ mode, origin, csrf, current, other, signIn, tenant });
	}
	await t.test("rejected cookie logout preserves the session and sends no deletion cookie", async () => {
		const client = clients[1];
		const cookie = `${client.current.credential.Cookie}; ${client.csrf.Cookie}`;
		for (const proof of [
			{},
			{ Origin: client.origin },
			{ Origin: "http://attacker.test", "X-CSRF-Token": client.csrf["X-CSRF-Token"] },
			{ Origin: client.origin, "X-CSRF-Token": "forged" },
		]) {
			const response = await fetch(`${client.origin}/auth/logout`, {
				method: "POST",
				headers: { Cookie: cookie, ...proof },
			});
			assert.equal(response.status, 403);
			assert.deepEqual(response.headers.getSetCookie(), []);
			assert.equal((await fetch(`${client.origin}/identity`, { headers: client.current.credential })).status, 200);
		}
	});
	await t.test("wrong tenant and credential mode cannot revoke a session", async () => {
		for (const client of clients) {
			const token =
				client.mode === "JWT" ? client.current.session.jwt_token : client.current.credential.Cookie.split("=")[1];
			const other = clients.find((candidate) => candidate !== client);
			for (const context of [
				{ tenantApplicationKey: other.tenant.tenantApplication.key, mode: client.mode },
				{ tenantApplicationKey: client.tenant.tenantApplication.key, mode: other.mode },
			]) {
				const response = await fetch(`${integration.origin}/api/auth/logout`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ token, ...context }),
				});
				assert.equal(response.status, 401);
				assert.equal((await fetch(`${client.origin}/identity`, { headers: client.current.credential })).status, 200);
			}
		}
	});
	for (const client of clients) {
		await t.test(`${client.mode} logout denies replay while other sessions remain usable`, async () => {
			const headers = { ...client.csrf, ...client.current.credential };
			if (client.mode === "COOKIE") headers.Cookie += `; ${client.csrf.Cookie}`;
			const response = await fetch(`${client.origin}/auth/logout`, { method: "POST", headers });
			assert.equal(response.status, 204);
			if (client.mode === "COOKIE") {
				assert.match(response.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/);
				assert.match(response.headers.getSetCookie()[0], /HttpOnly/);
				assert.match(response.headers.getSetCookie()[0], /SameSite=Lax/);
			}
			assert.equal((await fetch(`${client.origin}/identity`, { headers: client.current.credential })).status, 401);
			for (const other of clients)
				assert.equal((await fetch(`${other.origin}/identity`, { headers: other.other.credential })).status, 200);
			const fresh = await client.signIn();
			assert.equal((await fetch(`${client.origin}/identity`, { headers: fresh.credential })).status, 200);
		});
	}
});
