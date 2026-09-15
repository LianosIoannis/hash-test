import express from "express";
import { getDatabaseOverview } from "../db/overview.js";
import { errorHandler } from "./errors.js";
import { applicationsRouter } from "./routes/applications.js";
import { membershipsRouter } from "./routes/memberships.js";
import { sessionsRouter } from "./routes/sessions.js";
import { tenantApplicationsRouter } from "./routes/tenant-applications.js";
import { tenantsRouter } from "./routes/tenants.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
	const app = express();

	app.disable("x-powered-by");
	app.use(express.json({ limit: "100kb" }));

	app.use((request, response, next) => {
		const origin = request.headers.origin;

		if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
			response.setHeader("Access-Control-Allow-Origin", origin);
			response.setHeader("Vary", "Origin");
			response.setHeader("Access-Control-Allow-Headers", "Content-Type");
			response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
		}

		if (request.method === "OPTIONS") {
			response.status(204).send();
			return;
		}

		next();
	});

	app.get("/api/health", (_request, response) => {
		response.json({ status: "ok" });
	});

	app.get("/api/overview", async (_request, response) => {
		response.json(await getDatabaseOverview());
	});

	app.use("/api/tenants", tenantsRouter);
	app.use("/api/applications", applicationsRouter);
	app.use("/api/tenant-applications", tenantApplicationsRouter);
	app.use("/api/users", usersRouter);
	app.use("/api/memberships", membershipsRouter);
	app.use("/api/sessions", sessionsRouter);

	app.use((_request, response) => {
		response.status(404).json({
			error: {
				code: "ROUTE_NOT_FOUND",
				message: "Route not found",
			},
		});
	});

	app.use(errorHandler);

	return app;
}
