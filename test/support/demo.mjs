import express from "express";

export async function startDemoFixture(integration, tenant, mode) {
	await integration.prisma.tenantApplication.update({
		where: { id: tenant.tenantApplication.id },
		data: { sessionStrategy: mode },
	});
	const strategy = await fetch(
		`${integration.base}/tenant-applications/${tenant.tenantApplication.id}/strategies/EMAIL_PASSWORD`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		},
	);
	if (!strategy.ok) throw new Error("Demo fixture strategy setup failed");
	// Import application modules only after the temporary database is configured.
	const { createDemoApp } = await import("../../src/demo/app.ts");
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
