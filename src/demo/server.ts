import "dotenv/config";
import { createDemoApp } from "./app.js";

const tenantApplicationKey = process.env.DEMO_TENANT_APPLICATION_KEY;
if (!tenantApplicationKey) throw new Error("DEMO_TENANT_APPLICATION_KEY is required");
const port = Number(process.env.DEMO_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid DEMO_PORT");
const server = createDemoApp({
	centralUrl: process.env.CENTRAL_AUTH_URL ?? "http://127.0.0.1:3000",
	tenantApplicationKey,
}).listen(port, "127.0.0.1", () => {
	console.log(`Authentication demo: http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
	process.once(signal, () => {
		server.close();
	});
