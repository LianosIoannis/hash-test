import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { launchBrowser } from "./support/browser.mjs";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("local admin UI displays and changes the selected session mode", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	const tenant = fixtures.tenants[0];
	for (const fixture of fixtures.tenants)
		await fetch(`${integration.base}/tenant-applications/${fixture.tenantApplication.id}/strategies/EMAIL_PASSWORD`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});
	const { createDemoApp } = await import("../src/demo/app.ts");
	async function demo(mode) {
		const host = express();
		const origin = await integration.startServer(host);
		host.use(
			createDemoApp({
				centralUrl: integration.origin,
				tenantApplicationKey: tenant.tenantApplication.key,
				sessionMode: mode,
				publicOrigin: origin,
				allowInsecureCookies: true,
			}),
		);
		return origin;
	}
	const jwtOrigin = await demo("JWT");
	const cookieOrigin = await demo("COOKIE");
	const other = fixtures.tenants[1];
	const otherSession = await (
		await fetch(`${integration.origin}/api/auth/signin`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "shared@example.test",
				password: "IntegrationPassword123!",
				tenantApplicationKey: other.tenantApplication.key,
				mode: "JWT",
			}),
		})
	).json();
	const app = express();
	app.use("/api", express.json(), async (request, response) => {
		const upstream = await fetch(`${integration.base}${request.url}`, {
			method: request.method,
			headers: { "Content-Type": "application/json" },
			...(request.method === "GET" ? {} : { body: JSON.stringify(request.body) }),
		});
		response.status(upstream.status).send(await upstream.text());
	});
	app.use(express.static(fileURLToPath(new URL("../client/dist/", import.meta.url))));
	const origin = await integration.startServer(app);
	const browser = await launchBrowser(integration.directory, origin);
	try {
		async function openTenantApplicationEditor() {
			await browser.navigate(origin);
			await browser.waitFor(
				`location.origin === ${JSON.stringify(origin)} && document.body.textContent.includes('API connected')`,
			);
			await browser.evaluate(`document.querySelector('[data-view="tenant-applications"]').click()`);
			await browser.waitFor(
				`document.querySelector('tbody')?.textContent.includes(${JSON.stringify(tenant.tenantApplication.key)})`,
			);
			await browser.evaluate(
				`Array.from(document.querySelectorAll('tbody tr')).find(row => row.textContent.includes(${JSON.stringify(tenant.tenantApplication.key)})).querySelector('[aria-label="Edit"]').click()`,
			);
			await browser.waitFor(`document.querySelector('dialog[open] [name=sessionStrategy]') !== null`);
		}
		await openTenantApplicationEditor();
		assert.equal(await browser.evaluate(`document.querySelector('dialog[open] [name=sessionStrategy]')?.value`), "JWT");
		async function goDemo(target) {
			await browser.navigate(target);
			await browser.waitFor(
				`location.origin === ${JSON.stringify(target)} && document.querySelector('#result')?.textContent === 'Sign in to access your identity'`,
			);
		}
		async function signIn() {
			await browser.evaluate(
				`document.querySelector('[name=email]').value = 'shared@example.test'; document.querySelector('[name=password]').value = 'IntegrationPassword123!'; document.querySelector('form').requestSubmit()`,
			);
			await browser.waitFor(`document.querySelector('#result')?.textContent.includes('"membershipId"')`);
			return JSON.parse(await browser.evaluate(`document.querySelector('#result').textContent`));
		}
		async function setMode(mode) {
			await openTenantApplicationEditor();
			assert.equal(
				await browser.evaluate(`document.querySelector('dialog[open]').textContent.includes('signs out all users')`),
				true,
			);
			await browser.evaluate(
				`document.querySelector('dialog[open] [name=sessionStrategy]').value = ${JSON.stringify(mode)}; document.querySelector('dialog[open] form').requestSubmit()`,
			);
			await browser.waitFor(
				`!document.querySelector('dialog[open]') && Array.from(document.querySelectorAll('tbody tr')).some(row => row.textContent.includes(${JSON.stringify(tenant.tenantApplication.key)}) && row.textContent.includes(${JSON.stringify(mode)}))`,
			);
		}
		const verify = (token, key, mode) =>
			fetch(`${integration.origin}/api/auth/verify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, tenantApplicationKey: key, mode }),
			});
		await goDemo(jwtOrigin);
		const firstIdentity = await signIn();
		const oldJwt = await browser.evaluate(`Object.values(sessionStorage)[0]`);
		await setMode("COOKIE");
		assert.equal((await verify(oldJwt, tenant.tenantApplication.key, "JWT")).status, 401);
		assert.equal((await verify(otherSession.jwt_token, other.tenantApplication.key, "JWT")).status, 200);
		await goDemo(jwtOrigin);
		assert.equal(await browser.evaluate(`sessionStorage.length`), 0);
		await goDemo(cookieOrigin);
		await signIn();
		const oldCookie = (await browser.cookies()).find((cookie) => cookie.name.startsWith("company-auth-"));
		assert.ok(oldCookie);
		await setMode("JWT");
		assert.equal((await verify(oldCookie.value, tenant.tenantApplication.key, "COOKIE")).status, 401);
		assert.equal((await verify(oldJwt, tenant.tenantApplication.key, "JWT")).status, 401);
		await goDemo(cookieOrigin);
		await goDemo(jwtOrigin);
		assert.notEqual((await signIn()).sessionId, firstIdentity.sessionId);
		await setMode("COOKIE");
		assert.equal((await verify(oldCookie.value, tenant.tenantApplication.key, "COOKIE")).status, 401);
		assert.equal((await verify(otherSession.jwt_token, other.tenantApplication.key, "JWT")).status, 200);
	} finally {
		await browser.close();
	}
});
