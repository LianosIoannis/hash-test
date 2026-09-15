import { Router } from "express";
import * as v from "valibot";
import { createTenant, deleteTenant, updateTenant } from "../../db/tenants/actions.js";
import { findTenantById, findTenants } from "../../db/tenants/queries.js";
import { createTenantSchema, updateTenantSchema } from "../schemas.js";
import { parseId, requireRecord } from "../validation.js";

export const tenantsRouter = Router();

tenantsRouter.get("/", async (_request, response) => {
	response.json(await findTenants());
});

tenantsRouter.get("/:id", async (request, response) => {
	const tenant = requireRecord(await findTenantById(parseId(request.params.id)), "Tenant");
	response.json(tenant);
});

tenantsRouter.post("/", async (request, response) => {
	const input = v.parse(createTenantSchema, request.body);
	const tenant = await createTenant(input.name, input.description ?? undefined);
	response.status(201).json(tenant);
});

tenantsRouter.patch("/:id", async (request, response) => {
	const input = v.parse(updateTenantSchema, request.body);
	response.json(await updateTenant(parseId(request.params.id), input));
});

tenantsRouter.delete("/:id", async (request, response) => {
	await deleteTenant(parseId(request.params.id));
	response.status(204).send();
});
