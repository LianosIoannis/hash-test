import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./support/browser.mjs";
import { startControlledCentral } from "./support/central-failures.mjs";
import { startDemoFixture } from "./support/demo.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("browser reports central failures and clears credentials on failed logout", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	const central = await startControlledCentral(integration);
	for (const [index, mode] of ["JWT", "COOKIE"].entries()) {
		await t.test(mode, async () => {
			const origin = await startDemoFixture(integration, fixtures.tenants[index], mode, {
				centralUrl: central.origin,
				timeoutMs: 400,
			});
			const browser = await launchBrowser(integration.directory, origin);
			try {
				await browser.waitFor(`document.querySelector('#result')?.textContent === 'Sign in to access your identity'`);
				const submit = () =>
					browser.evaluate(
						`document.querySelector('[name=email]').value = 'shared@example.test'; document.querySelector('[name=password]').value = 'IntegrationPassword123!'; document.querySelector('form').requestSubmit()`,
					);
				central.fail("unavailable");
				await submit();
				await browser.waitFor(
					`document.querySelector('#result')?.textContent === 'Authentication service temporarily unavailable; try again later'`,
				);
				assert.equal(await browser.evaluate(`sessionStorage.length`), 0);
				assert.equal(
					(await browser.cookies()).some((cookie) => cookie.name.startsWith("company-auth-")),
					false,
				);
				central.fail(undefined);
				await submit();
				await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
				const identity = JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`));
				const before = await (await fetch(`${integration.base}/sessions/${identity.sessionId}`)).json();
				const sessionCookie = (await browser.cookies()).find((cookie) => cookie.name.startsWith("company-auth-"));
				const token = mode === "JWT" ? await browser.evaluate(`Object.values(sessionStorage)[0]`) : sessionCookie.value;
				const headers =
					mode === "JWT" ? { Authorization: `Bearer ${token}` } : { Cookie: `${sessionCookie.name}=${token}` };
				central.fail("stall");
				await browser.evaluate(`document.querySelector('#identity').click()`);
				await browser.waitFor(
					`document.querySelector('#result')?.textContent === 'Authentication service temporarily unavailable; try again later'`,
				);
				if (mode === "JWT") assert.equal(await browser.evaluate(`Object.values(sessionStorage)[0]`), token);
				else assert.equal((await browser.cookies()).find((cookie) => cookie.name === sessionCookie.name).value, token);
				await browser.reload();
				await browser.waitFor(
					`document.querySelector('#result')?.textContent === 'Authentication service temporarily unavailable; try again later'`,
				);
				await browser.evaluate(`document.querySelector('#mutation').click()`);
				await browser.waitFor(
					`document.querySelector('#mutation-result')?.textContent === 'Authentication service temporarily unavailable; try again later'`,
				);
				central.fail(undefined);
				await browser.evaluate(`document.querySelector('#identity').click()`);
				await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
				assert.equal(
					JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`)).sessionId,
					identity.sessionId,
				);
				assert.equal(
					(await (await fetch(`${integration.base}/sessions/${identity.sessionId}`)).json()).expiresAt,
					before.expiresAt,
				);
				assert.deepEqual(await (await fetch(`${origin}/mutation`, { headers })).json(), { value: 0 });
				for (const failure of ["disconnect", "stall"]) {
					const logoutCookie = (await browser.cookies()).find((cookie) => cookie.name.startsWith("company-auth-"));
					const logoutToken =
						mode === "JWT" ? await browser.evaluate(`Object.values(sessionStorage)[0]`) : logoutCookie.value;
					const logoutHeaders =
						mode === "JWT"
							? { Authorization: `Bearer ${logoutToken}` }
							: { Cookie: `${logoutCookie.name}=${logoutToken}` };
					central.fail(failure);
					if (mode === "COOKIE") {
						assert.equal(await browser.evaluate(`fetch('/auth/logout', {method:'POST'}).then(r => r.status)`), 403);
						assert.equal(
							(await browser.cookies()).find((cookie) => cookie.name === logoutCookie.name).value,
							logoutToken,
						);
					}
					await browser.evaluate(`document.querySelector('#logout').click()`);
					await browser.waitFor(
						`document.querySelector('#result')?.textContent === 'Local credential cleared; central invalidation was not confirmed. The session may remain valid until expiry or successful logout.'`,
					);
					assert.equal(await browser.evaluate(`sessionStorage.length`), 0);
					if (mode === "COOKIE")
						assert.equal(
							(await browser.cookies()).some((cookie) => cookie.name === sessionCookie.name),
							false,
						);
					central.fail(undefined);
					assert.equal((await fetch(`${origin}/identity`, { headers: logoutHeaders })).status, 200);
					await browser.reload();
					await browser.waitFor(`document.querySelector('#result')?.textContent === 'Sign in to access your identity'`);
					// Start a fresh browser session for the next failure scenario.
					if (failure === "disconnect") {
						await submit();
						await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
					}
				}
				const revoked = await fetch(`${integration.origin}/api/auth/logout`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ token, mode, tenantApplicationKey: fixtures.tenants[index].tenantApplication.key }),
				});
				assert.equal(revoked.status, 204);
				assert.equal((await fetch(`${origin}/identity`, { headers })).status, 401);
				await submit();
				await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
				await browser.evaluate(`document.querySelector('#logout').click()`);
				await browser.waitFor(`document.querySelector('#result')?.textContent === 'Signed out'`);
			} finally {
				central.fail(undefined);
				await browser.close();
			}
		});
	}
});
