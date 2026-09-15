import { Router } from "express";
import * as v from "valibot";
import { createMembership, deleteMembership } from "../../db/memberships/actions.js";
import { findMembershipById, findMemberships } from "../../db/memberships/queries.js";
import { createMembershipSchema } from "../schemas.js";
import { parseId, requireRecord } from "../validation.js";

export const membershipsRouter = Router();

membershipsRouter.get("/", async (_request, response) => {
	response.json(await findMemberships());
});

membershipsRouter.get("/:id", async (request, response) => {
	const membership = requireRecord(await findMembershipById(parseId(request.params.id)), "Membership");
	response.json(membership);
});

membershipsRouter.post("/", async (request, response) => {
	const input = v.parse(createMembershipSchema, request.body);
	const membership = await createMembership(input.userId, input.tenantApplicationId);
	response.status(201).json(membership);
});

membershipsRouter.delete("/:id", async (request, response) => {
	await deleteMembership(parseId(request.params.id));
	response.status(204).send();
});
