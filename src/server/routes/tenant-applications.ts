import { Router } from "express";
import * as v from "valibot";
import {
	createTenantApplication,
	deleteTenantApplication,
	updateTenantApplication,
} from "../../db/tenant-applications/actions.js";
import { findTenantApplicationById, findTenantApplications } from "../../db/tenant-applications/queries.js";
import { createTenantApplicationSchema, updateTenantApplicationSchema } from "../schemas.js";
import { parseId, requireRecord } from "../validation.js";

export const tenantApplicationsRouter = Router();

tenantApplicationsRouter.get("/", async (request, response) => {
	const tenantId =
		request.query.tenantId === undefined ? undefined : parseId(String(request.query.tenantId), "tenantId");
	response.json(await findTenantApplications(tenantId));
});

tenantApplicationsRouter.get("/:id", async (request, response) => {
	const tenantApplication = requireRecord(
		await findTenantApplicationById(parseId(request.params.id)),
		"Tenant application",
	);
	response.json(tenantApplication);
});

tenantApplicationsRouter.post("/", async (request, response) => {
	const input = v.parse(createTenantApplicationSchema, request.body);
	const tenantApplication = await createTenantApplication(input.tenantId, input.applicationId, input.key);
	response.status(201).json(tenantApplication);
});

tenantApplicationsRouter.patch("/:id", async (request, response) => {
	const input = v.parse(updateTenantApplicationSchema, request.body);
	response.json(await updateTenantApplication(parseId(request.params.id), input));
});

tenantApplicationsRouter.delete("/:id", async (request, response) => {
	await deleteTenantApplication(parseId(request.params.id));
	response.status(204).send();
});
