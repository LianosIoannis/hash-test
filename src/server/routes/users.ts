import { Router } from "express";
import * as v from "valibot";
import { hashPassword } from "../../argon2/index.js";
import { deleteUserSessions } from "../../db/sessions/actions.js";
import { createUser, deleteUser, updateUser, updateUserPasswordHash } from "../../db/users/actions.js";
import { findUserById, findUsers } from "../../db/users/queries.js";
import { createUserSchema, updatePasswordSchema, updateUserSchema } from "../schemas.js";
import { parseId, requireRecord } from "../validation.js";

export const usersRouter = Router();

usersRouter.get("/", async (request, response) => {
	const tenantId =
		request.query.tenantId === undefined ? undefined : parseId(String(request.query.tenantId), "tenantId");
	response.json(await findUsers(tenantId));
});

usersRouter.get("/:id", async (request, response) => {
	const user = requireRecord(await findUserById(parseId(request.params.id)), "User");
	response.json(user);
});

usersRouter.post("/", async (request, response) => {
	const input = v.parse(createUserSchema, request.body);
	const passwordHash = await hashPassword(input.password);
	const user = await createUser(input.email, input.username, passwordHash, input.tenantId);
	response.status(201).json(user);
});

usersRouter.patch("/:id", async (request, response) => {
	const input = v.parse(updateUserSchema, request.body);
	response.json(await updateUser(parseId(request.params.id), input));
});

usersRouter.put("/:id/password", async (request, response) => {
	const { password } = v.parse(updatePasswordSchema, request.body);
	const passwordHash = await hashPassword(password);
	response.json(await updateUserPasswordHash(parseId(request.params.id), passwordHash));
});

usersRouter.delete("/:id/sessions", async (request, response) => {
	response.json(await deleteUserSessions(parseId(request.params.id)));
});

usersRouter.delete("/:id", async (request, response) => {
	await deleteUser(parseId(request.params.id));
	response.status(204).send();
});
