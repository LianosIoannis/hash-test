import { Router } from "express";
import { deleteExpiredSessions, deleteSession } from "../../db/sessions/actions.js";
import { findSessionById, findSessions } from "../../db/sessions/queries.js";
import { parseId, requireRecord } from "../validation.js";

export const sessionsRouter = Router();

sessionsRouter.get("/", async (_request, response) => {
	response.json(await findSessions());
});

sessionsRouter.get("/:id", async (request, response) => {
	const session = requireRecord(await findSessionById(parseId(request.params.id)), "Session");
	response.json(session);
});

sessionsRouter.delete("/expired", async (_request, response) => {
	response.json(await deleteExpiredSessions());
});

sessionsRouter.delete("/:id", async (request, response) => {
	await deleteSession(parseId(request.params.id));
	response.status(204).send();
});
