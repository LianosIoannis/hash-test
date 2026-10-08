import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { launchBrowser } from "./support/browser.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("one demo browser navigates both tenants through sign-in, reload and logout", async (t) => {
	const integration = await createIntegration(t);
	const { tenants } = await seedTenantFixtures(integration.base);
	for (const [index, mode] of ["JWT", "COOKIE"].entries()) {
		const id = tenants[index].tenantApplication.id;
		assert.equal(
			(
				await fetch(`${integration.base}/tenant-applications/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sessionStrategy: mode }),
				})
			).status,
			200,
		);
		assert.equal(
			(
				await fetch(`${integration.base}/tenant-applications/${id}/strategies/EMAIL_PASSWORD`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ enabled: true }),
				})
			).status,
			200,
		);
	}
	const { createDemoHost } = await import("../src/demo/host.ts");
	const app = express();
	const origin = await integration.startServer(app);
	app.use(
		createDemoHost({
			centralUrl: integration.origin,
			tenantApplicationKey: tenants[0].tenantApplication.key,
			cookieTenantApplicationKey: tenants[1].tenantApplication.key,
			publicOrigin: origin,
			allowInsecureCookies: true,
		}),
	);
	const browser = await launchBrowser(integration.directory, origin);
	try {
		const identities = [];
		for (const [index, path] of ["/", "/cookie/"].entries()) {
			if (index) await browser.evaluate(`document.querySelector('nav a[href="/cookie/"]').click()`);
			await browser.waitFor(
				`location.pathname === ${JSON.stringify(path)} && document.querySelector('#result')?.textContent === 'Sign in to access your identity'`,
			);
			await browser.evaluate(
				`document.querySelector('[name=email]').value = 'shared@example.test'; document.querySelector('[name=password]').value = 'IntegrationPassword123!'; document.querySelector('form').requestSubmit()`,
			);
			await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
			const identity = JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`));
			assert.equal(identity.tenantId, tenants[index].tenant.id);
			assert.equal(identity.tenantApplicationId, tenants[index].tenantApplication.id);
			identities.push(identity);
			await browser.reload();
			await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
			assert.equal(
				JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`)).sessionId,
				identity.sessionId,
			);
		}
		await browser.evaluate(`document.querySelector('#logout').click()`);
		await browser.waitFor(`document.querySelector('#result')?.textContent === 'Signed out'`);
		assert.equal(
			(await browser.cookies()).some((cookie) => cookie.name.startsWith("company-auth-")),
			false,
		);
		assert.equal(await browser.evaluate(`sessionStorage.length`), 1);
		await browser.evaluate(`document.querySelector('nav a[href="/"]').click()`);
		await browser.waitFor(
			`location.pathname === '/' && document.querySelector('#result')?.textContent.includes('"membershipId"')`,
		);
		assert.equal(
			JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`)).sessionId,
			identities[0].sessionId,
		);
		await browser.evaluate(`document.querySelector('#logout').click()`);
		await browser.waitFor(`document.querySelector('#result')?.textContent === 'Signed out'`);
		assert.equal(await browser.evaluate(`sessionStorage.length`), 0);
	} finally {
		await browser.close();
	}
});
