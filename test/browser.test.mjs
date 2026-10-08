import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import express from "express";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

const execute = promisify(execFile);

test("real browser renders the admin overview from the isolated central API", async (t) => {
	const executable = process.env.BROWSER_EXECUTABLE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
	assert.ok(existsSync(executable), "Set BROWSER_EXECUTABLE to an installed Chromium or Edge executable");
	const assets = fileURLToPath(new URL("../client/dist/", import.meta.url));
	assert.ok(existsSync(join(assets, "index.html")), "Build the browser client before running its smoke test");
	const integration = await createIntegration(t);
	await seedTenantFixtures(integration.base);
	const app = express();
	app.get("/api/overview", async (_request, response) => {
		const upstream = await fetch(`${integration.base}/overview`);
		response.status(upstream.status).json(await upstream.json());
	});
	app.use(express.static(assets));
	const origin = await integration.startServer(app);
	const { stdout } = await execute(
		executable,
		[
			"--headless",
			"--disable-gpu",
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-extensions",
			`--user-data-dir=${join(integration.directory, "browser-profile")}`,
			"--dump-dom",
			"--virtual-time-budget=10000",
			origin,
		],
		{ timeout: 45000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
	);
	const renderedText = stdout.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
	assert.match(renderedText, /API connected/);
	assert.match(renderedText, /2\s+Tenants\s+Organizations/);
	assert.match(renderedText, /1\s+Applications\s+Global products/);
	assert.match(renderedText, /2\s+Memberships\s+Application grants/);
});
