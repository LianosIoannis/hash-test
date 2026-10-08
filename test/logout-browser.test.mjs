import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./support/browser.mjs";
import { startDemoFixture } from "./support/demo.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("browser logout removes credentials and invalidates sessions in both modes", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	for (const [index, mode] of ["JWT", "COOKIE"].entries()) {
		await t.test(mode, async () => {
			const tenant = fixtures.tenants[index];
			const origin = await startDemoFixture(integration, tenant, mode);
			const browser = await launchBrowser(integration.directory, origin);
			try {
				await browser.waitFor(`document.querySelector('#result')?.textContent === 'Sign in to access your identity'`);
				const signIn = async () => {
					await browser.evaluate(
						`document.querySelector('[name=email]').value = 'shared@example.test'; document.querySelector('[name=password]').value = 'IntegrationPassword123!'; document.querySelector('form').requestSubmit()`,
					);
					await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
					return JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`));
				};
				const identity = await signIn();
				const cookies = await browser.cookies();
				const sessionCookie = cookies.find((cookie) => cookie.name.startsWith("company-auth-"));
				const token = mode === "JWT" ? await browser.evaluate(`Object.values(sessionStorage)[0]`) : sessionCookie.value;
				if (mode === "COOKIE") {
					assert.equal(await browser.evaluate(`fetch('/auth/logout', {method:'POST'}).then(r => r.status)`), 403);
					assert.equal(
						(await browser.cookies()).find((cookie) => cookie.name === sessionCookie.name).value,
						sessionCookie.value,
					);
					assert.equal(await browser.evaluate(`fetch('/identity').then(r => r.status)`), 200);
				}
				assert.equal(await browser.evaluate(`!!document.querySelector('#logout')`), true);
				await browser.evaluate(`document.querySelector('#logout').click()`);
				await browser.waitFor(`document.querySelector('#result')?.textContent === 'Signed out'`);
				assert.equal(await browser.evaluate(`sessionStorage.length`), 0);
				if (mode === "COOKIE")
					assert.equal(
						(await browser.cookies()).some((cookie) => cookie.name === sessionCookie.name),
						false,
					);
				const headers =
					mode === "JWT" ? { Authorization: `Bearer ${token}` } : { Cookie: `${sessionCookie.name}=${token}` };
				assert.equal((await fetch(`${origin}/identity`, { headers })).status, 401);
				await browser.reload();
				await browser.waitFor(`document.querySelector('#result')?.textContent === 'Sign in to access your identity'`);
				assert.equal(await browser.evaluate(`fetch('/identity').then(r => r.status)`), 401);
				const freshIdentity = await signIn();
				assert.notEqual(freshIdentity.sessionId, identity.sessionId);
			} finally {
				await browser.close();
			}
		});
	}
});
