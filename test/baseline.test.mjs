import assert from "node:assert/strict";
import test from "node:test";
import { createIntegration, seedTenantFixtures } from "./support/integration.mjs";

test("administrators can provision two isolated tenants for the same application", async (t) => {
	const integration = await createIntegration(t);
	const fixtures = await seedTenantFixtures(integration.base);
	for (const fixture of fixtures.tenants) {
		const users = await fetch(`${integration.base}/users?tenantId=${fixture.tenant.id}`).then((response) =>
			response.json(),
		);
		assert.deepEqual(
			users.map((user) => user.id),
			[fixture.user.id],
		);
		assert.equal(users[0].email, "shared@example.test");
		const tenantApplication = await fetch(
			`${integration.base}/tenant-applications/${fixture.tenantApplication.id}`,
		).then((response) => response.json());
		assert.equal(tenantApplication.applicationId, fixtures.application.id);
	}
	const crossTenant = await fetch(`${integration.base}/memberships`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			userId: fixtures.tenants[0].user.id,
			tenantApplicationId: fixtures.tenants[1].tenantApplication.id,
		}),
	});
	assert.equal(crossTenant.status, 400);
});
