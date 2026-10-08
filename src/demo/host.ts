import express from "express";
import type { BackendAuthOptions } from "../library/backend.js";
import { createDemoApp } from "./app.js";

export function createDemoHost(options: BackendAuthOptions & { cookieTenantApplicationKey?: string }) {
	const app = express();
	const { cookieTenantApplicationKey, ...primaryOptions } = options;
	if (cookieTenantApplicationKey) {
		app.get(/^\/cookie$/, (_request, response) => response.redirect("/cookie/"));
		app.use(
			"/cookie",
			createDemoApp(
				{ ...primaryOptions, tenantApplicationKey: cookieTenantApplicationKey, sessionMode: "COOKIE" },
				true,
			),
		);
	}
	app.use(createDemoApp(primaryOptions, !!cookieTenantApplicationKey));
	return app;
}
