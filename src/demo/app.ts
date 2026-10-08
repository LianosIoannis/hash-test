import { fileURLToPath } from "node:url";
import express from "express";
import { type BackendAuthOptions, createBackendAuth } from "../library/backend.js";

export function createDemoApp(options: BackendAuthOptions, showTenantNavigation = false) {
	const app = express();
	const auth = createBackendAuth(options);
	app.disable("x-powered-by");
	app.use("/auth", auth.router);
	app.get("/identity", auth.authenticate, (request, response) => {
		response.json(request.auth);
	});
	let mutations = 0;
	app.get("/mutation", auth.authenticate, (_request, response) => response.json({ value: mutations }));
	app.post("/mutation", auth.authenticate, (_request, response) => response.json({ value: ++mutations }));
	app.get("/config", (request, response) => {
		response.json({
			tenantApplicationKey: options.tenantApplicationKey,
			sessionMode: options.sessionMode ?? "JWT",
			basePath: `${request.baseUrl}/auth`,
			applicationPath: request.baseUrl,
		});
	});
	app.get("/library/browser.js", (_request, response) => {
		response.sendFile(fileURLToPath(new URL("../../dist/library/browser.js", import.meta.url)));
	});
	app.get("/demo.js", (_request, response) => {
		response.sendFile(fileURLToPath(new URL("../../dist/demo/browser.js", import.meta.url)));
	});
	app.get("/", (_request, response) => {
		response
			.type("html")
			.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Authentication demo</title></head><body>
<h1>Authentication demo</h1><form id="signin"><label>Email <input name="email" type="email" required></label><label>Password <input name="password" type="password" required></label><button>Sign in</button></form>
${showTenantNavigation ? '<nav aria-label="Tenant applications"><a href="/">JWT tenant</a> | <a href="/cookie/">COOKIE tenant</a></nav>' : ""}
<button id="identity">Check identity</button><button id="logout">Log out</button><button id="mutation">Increment protected counter</button><pre id="mutation-result" aria-live="polite"></pre><pre id="result" aria-live="polite">Loading</pre><script type="module" src="demo.js"></script></body></html>`);
	});
	return app;
}
