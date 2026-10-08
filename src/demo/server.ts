import "dotenv/config";
import { createDemoHost } from "./host.js";

const tenantApplicationKey = process.env.DEMO_TENANT_APPLICATION_KEY;
if (!tenantApplicationKey) throw new Error("DEMO_TENANT_APPLICATION_KEY is required");
const port = Number(process.env.DEMO_PORT ?? 3001);
const sessionMode = process.env.DEMO_SESSION_MODE ?? "JWT";
if (sessionMode !== "JWT" && sessionMode !== "COOKIE") throw new Error("Invalid DEMO_SESSION_MODE");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid DEMO_PORT");
const centralUrl = process.env.CENTRAL_AUTH_URL ?? "http://127.0.0.1:3000";
const cookieTenantKey = process.env.DEMO_COOKIE_TENANT_APPLICATION_KEY;
const app = createDemoHost({
	centralUrl,
	tenantApplicationKey,
	sessionMode,
	...(cookieTenantKey ? { cookieTenantApplicationKey: cookieTenantKey } : {}),
	...(process.env.DEMO_PUBLIC_ORIGIN ? { publicOrigin: process.env.DEMO_PUBLIC_ORIGIN } : {}),
	allowInsecureCookies: process.env.DEMO_ALLOW_INSECURE_COOKIES === "true",
});
const server = app.listen(port, "127.0.0.1", () => {
	console.log(`Authentication demo: http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
	process.once(signal, () => {
		server.close();
	});
