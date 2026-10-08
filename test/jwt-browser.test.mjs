import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./support/browser.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("browser JWT sign-in survives a real reload without renewing the session", async (t) => {
	const integration = await createIntegration(t);
	const fixture = (await seedTenantFixtures(integration.base)).tenants[0];
	await fetch(`${integration.base}/tenant-applications/${fixture.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ enabled: true }),
	});
	const { createDemoApp } = await import("../src/demo/app.ts");
	const origin = await integration.startServer(
		createDemoApp({ centralUrl: integration.origin, tenantApplicationKey: fixture.tenantApplication.key }),
	);
	const browser = await launchBrowser(integration.directory, origin);
	try {
		await browser.waitFor(`document.querySelector('#result')?.textContent === 'Sign in to access your identity'`);
		await browser.evaluate(
			`document.querySelector('[name=email]').value = 'shared@example.test'; document.querySelector('[name=password]').value = 'IntegrationPassword123!'; document.querySelector('form').requestSubmit()`,
		);
		await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
		const identity = JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`));
		assert.equal(identity.userId, fixture.user.id);
		const stored = await browser.evaluate(`Object.values(sessionStorage)[0]`);
		assert.ok(stored);
		await browser.reload();
		await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
		assert.deepEqual(JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`)), identity);
		assert.equal(await browser.evaluate(`Object.values(sessionStorage)[0]`), stored);
		await fetch(`${integration.base}/sessions/${identity.sessionId}`, { method: "DELETE" });
		await browser.evaluate(`document.querySelector('#identity').click()`);
		await browser.waitFor(`document.querySelector('#result')?.textContent === 'Request failed (401)'`);
		assert.equal(await browser.evaluate(`sessionStorage.length`), 0);
	} finally {
		await browser.close();
	}
});
