import assert from "node:assert/strict";
import test from "node:test";
import { startControlledCentral } from "./support/central-failures.mjs";
import { startDemoFixture } from "./support/demo.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("central failures are bounded and do not authorize protected handlers", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	const central = await startControlledCentral(integration);
	for (const [index, mode] of ["JWT", "COOKIE"].entries()) {
		await t.test(mode, async () => {
			const origin = await startDemoFixture(integration, fixtures.tenants[index], mode, {
				centralUrl: central.origin,
				timeoutMs: 400,
			});
			let csrf = {};
			if (mode === "COOKIE") {
				const proof = await fetch(`${origin}/auth/csrf`);
				csrf = {
					Cookie: proof.headers.getSetCookie()[0].split(";")[0],
					Origin: origin,
					"X-CSRF-Token": (await proof.json()).csrfToken,
				};
			}
			const signIn = () =>
				fetch(`${origin}/auth/signin`, {
					method: "POST",
					headers: { "Content-Type": "application/json", ...csrf },
					body: JSON.stringify({ email: "shared@example.test", password: "IntegrationPassword123!" }),
					signal: AbortSignal.timeout(3000),
				});
			central.fail("unavailable");
			const response = await signIn();
			assert.equal(response.status, 503);
			assert.equal((await response.json()).error, "Authentication service unavailable");
			central.fail(undefined);
			const signedIn = await signIn();
			assert.equal(signedIn.status, 200);
			const session = await signedIn.json();
			const credential =
				mode === "JWT"
					? { Authorization: `Bearer ${session.jwt_token}` }
					: { Cookie: signedIn.headers.getSetCookie()[0].split(";")[0] };
			const unsafeHeaders = { ...credential, ...csrf };
			if (mode === "COOKIE") unsafeHeaders.Cookie = `${credential.Cookie}; ${csrf.Cookie}`;
			const protectedRequest = (path = "identity", method = "GET") =>
				fetch(`${origin}/${path}`, {
					method,
					headers: method === "GET" ? credential : unsafeHeaders,
					signal: AbortSignal.timeout(3000),
				});
			assert.equal((await protectedRequest()).status, 200);
			for (const failure of ["disconnect", "unavailable", "stall", "body"]) {
				central.fail(failure);
				const started = performance.now();
				const denied = await protectedRequest("mutation", "POST");
				assert.equal(denied.status, 503, failure);
				assert.equal((await denied.json()).error, "Authentication service unavailable");
				assert.ok(performance.now() - started < 2000, `${failure} must complete within a bounded timeout`);
				assert.equal((await signIn()).status, 503);
				if (mode === "COOKIE") {
					const rejected = await fetch(`${origin}/auth/logout`, { method: "POST", headers: credential });
					assert.equal(rejected.status, 403);
					assert.deepEqual(rejected.headers.getSetCookie(), []);
				}
				const logout = await fetch(`${origin}/auth/logout`, {
					method: "POST",
					headers: unsafeHeaders,
					signal: AbortSignal.timeout(3000),
				});
				assert.equal(logout.status, 503);
				assert.equal((await logout.json()).error, "Central logout failed");
				if (mode === "COOKIE") assert.match(logout.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/);
				central.fail(undefined);
				// Cleanup at the consuming application cannot revoke a central session.
				assert.equal((await protectedRequest()).status, 200);
				assert.deepEqual(await (await protectedRequest("mutation")).json(), { value: 0 });
			}
			const logout = await fetch(`${origin}/auth/logout`, { method: "POST", headers: unsafeHeaders });
			assert.equal(logout.status, 204);
			assert.equal((await protectedRequest()).status, 401);
			const fresh = await signIn();
			assert.equal(fresh.status, 200);
			const freshSession = await fresh.json();
			const freshCredential =
				mode === "JWT"
					? { Authorization: `Bearer ${freshSession.jwt_token}` }
					: { Cookie: fresh.headers.getSetCookie()[0].split(";")[0] };
			const identity = await (await fetch(`${origin}/identity`, { headers: freshCredential })).json();
			await integration.prisma.session.update({ where: { id: identity.sessionId }, data: { expiresAt: new Date(0) } });
			assert.equal((await fetch(`${origin}/identity`, { headers: freshCredential })).status, 401);
		});
	}
});
