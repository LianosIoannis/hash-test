import { Router } from "express";
import * as v from "valibot";
import { createApplication, deleteApplication, updateApplication } from "../../db/applications/actions.js";
import { findApplicationById, findApplications } from "../../db/applications/queries.js";
import { createApplicationSchema, updateApplicationSchema } from "../schemas.js";
import { parseId, requireRecord } from "../validation.js";

export const applicationsRouter = Router();

applicationsRouter.get("/", async (_request, response) => {
	response.json(await findApplications());
});

applicationsRouter.get("/:id", async (request, response) => {
	const application = requireRecord(await findApplicationById(parseId(request.params.id)), "Application");
	response.json(application);
});

applicationsRouter.post("/", async (request, response) => {
	const input = v.parse(createApplicationSchema, request.body);
	const application = await createApplication(input.code, input.name, input.description ?? undefined);
	response.status(201).json(application);
});

applicationsRouter.patch("/:id", async (request, response) => {
	const input = v.parse(updateApplicationSchema, request.body);
	response.json(await updateApplication(parseId(request.params.id), input));
});

applicationsRouter.delete("/:id", async (request, response) => {
	await deleteApplication(parseId(request.params.id));
	response.status(204).send();
});
