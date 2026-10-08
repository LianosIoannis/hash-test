import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import test from "node:test";
import express from "express";
import { launchBrowser } from "./support/browser.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("browser cookie sign-in survives reload and protects mutations", async (t) => {
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
		"/cookie",
		createDemoApp({
			centralUrl: integration.origin,
			tenantApplicationKey: tenant.tenantApplication.key,
			sessionMode: "COOKIE",
			publicOrigin: origin,
			allowInsecureCookies: true,
		}),
	);
	host.use(
		createDemoApp({ centralUrl: integration.origin, tenantApplicationKey: fixtures.tenants[0].tenantApplication.key }),
	);
	const browser = await launchBrowser(integration.directory, `${origin}/cookie/`);
	try {
		await browser.waitFor(`document.querySelector('#result')?.textContent === 'Sign in to access your identity'`);
		await browser.evaluate(
			`document.querySelector('[name=email]').value = 'shared@example.test'; document.querySelector('[name=password]').value = 'IntegrationPassword123!'; document.querySelector('form').requestSubmit()`,
		);
		await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
		const identity = JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`));
		assert.equal(identity.membershipId, tenant.membership.id);
		assert.equal(await browser.evaluate(`sessionStorage.length`), 0);
		assert.equal(await browser.evaluate(`localStorage.length`), 0);
		assert.equal(await browser.evaluate(`document.cookie`), "");
		const cookies = await browser.cookies();
		const sessionCookie = cookies.find((cookie) => cookie.name.startsWith("company-auth-"));
		assert.ok(sessionCookie);
		assert.equal(sessionCookie.httpOnly, true);
		assert.equal(sessionCookie.sameSite, "Lax");
		assert.equal(sessionCookie.secure, false);
		assert.equal(sessionCookie.domain, "127.0.0.1");
		assert.equal(sessionCookie.path, "/");
		assert.ok(sessionCookie.expires > Date.now() / 1000 + 7190);
		await browser.reload();
		await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
		assert.deepEqual(JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`)), identity);
		assert.equal(
			(await browser.cookies()).find((cookie) => cookie.name === sessionCookie.name).expires,
			sessionCookie.expires,
		);
		assert.equal(await browser.evaluate(`fetch('/cookie/mutation', {method:'POST'}).then(r => r.status)`), 403);
		assert.deepEqual(await browser.evaluate(`fetch('/cookie/mutation').then(r => r.json())`), { value: 0 });
		await browser.evaluate(`document.querySelector('#mutation').click()`);
		await browser.waitFor(`document.querySelector('#mutation-result')?.textContent === '{"value":1}'`);
		assert.deepEqual(
			await browser.evaluate(
				`(async () => { const {createAuthClient} = await import('/library/browser.js'); const config = await (await fetch('/cookie/config')).json(); const client = createAuthClient(config); return Promise.all([1,2,3].map(() => client.request('/cookie/mutation', {method:'POST'}).then(r => r.status))); })()`,
			),
			[200, 200, 200],
		);
	} finally {
		await browser.close();
	}
	await t.test("HTTPS uses Secure host-only cookies with actual browser delivery", async () => {
		const httpsHost = express();
		const server = createServer(
			{
				key: readFileSync(new URL("./support/localhost-key.pem", import.meta.url)),
				cert: readFileSync(new URL("./support/localhost-cert.pem", import.meta.url)),
			},
			httpsHost,
		);
		const secureOrigin = await integration.startServer(server, { protocol: "https:" });
		httpsHost.use(
			createDemoApp({
				centralUrl: integration.origin,
				tenantApplicationKey: tenant.tenantApplication.key,
				sessionMode: "COOKIE",
				publicOrigin: secureOrigin,
			}),
		);
		const secureBrowser = await launchBrowser(integration.directory, secureOrigin, { selfSignedCertificate: true });
		try {
			await secureBrowser.waitFor(
				`document.querySelector('#result')?.textContent === 'Sign in to access your identity'`,
			);
			await secureBrowser.evaluate(
				`document.querySelector('[name=email]').value = 'shared@example.test'; document.querySelector('[name=password]').value = 'IntegrationPassword123!'; document.querySelector('form').requestSubmit()`,
			);
			await secureBrowser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
			const cookies = await secureBrowser.cookies();
			const session = cookies.find((cookie) => cookie.name.startsWith("__Host-company-auth-"));
			assert.ok(session);
			assert.equal(session.secure, true);
			assert.equal(session.httpOnly, true);
			assert.equal(session.sameSite, "Lax");
			assert.equal(session.domain, "127.0.0.1");
			assert.equal(session.path, "/");
			assert.equal(await secureBrowser.evaluate(`document.cookie`), "");
			await secureBrowser.reload();
			await secureBrowser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
		} finally {
			await secureBrowser.close();
		}
	});
});
