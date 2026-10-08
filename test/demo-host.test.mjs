import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("two-tenant demo mounts public library integrations on one server", async (t) => {
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
	const origin = await integration.startServer(express());
	await integration.stopServer(origin);
	const child = spawn(process.execPath, ["--import", "tsx", "src/demo/server.ts"], {
		cwd: fileURLToPath(new URL("../", import.meta.url)),
		windowsHide: true,
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			CENTRAL_AUTH_URL: integration.origin,
			DEMO_TENANT_APPLICATION_KEY: tenants[0].tenantApplication.key,
			DEMO_COOKIE_TENANT_APPLICATION_KEY: tenants[1].tenantApplication.key,
			DEMO_SESSION_MODE: "JWT",
			DEMO_PORT: new URL(origin).port,
			DEMO_PUBLIC_ORIGIN: origin,
			DEMO_ALLOW_INSECURE_COOKIES: "true",
		},
	});
	const exited = once(child, "exit");
	void exited.catch(() => {});
	t.after(async () => {
		child.kill();
		let timer;
		try {
			await Promise.race([
				exited,
				new Promise((_, reject) => {
					timer = setTimeout(() => reject(new Error("Demo process did not exit")), 5000);
				}),
			]);
		} finally {
			clearTimeout(timer);
		}
	});
	await new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Demo startup timed out")), 10000);
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("exit", () => {
			clearTimeout(timer);
			reject(new Error("Demo exited before startup"));
		});
		child.stdout.on("data", (chunk) => {
			if (chunk.toString().includes(`Authentication demo: ${origin}`)) {
				clearTimeout(timer);
				resolve();
			}
		});
	});
	for (const [path, mode] of [
		["", "JWT"],
		["/cookie", "COOKIE"],
	]) {
		const html = await (await fetch(`${origin}${path}/`)).text();
		assert.match(html, /JWT tenant/);
		assert.match(html, /COOKIE tenant/);
		assert.deepEqual(await (await fetch(`${origin}${path}/config`)).json(), {
			tenantApplicationKey: tenants[mode === "JWT" ? 0 : 1].tenantApplication.key,
			sessionMode: mode,
			basePath: `${path}/auth`,
			applicationPath: path,
		});
	}
	assert.equal((await fetch(`${origin}/cookie`, { redirect: "manual" })).headers.get("location"), "/cookie/");
});
