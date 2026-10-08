import { Router } from "express";
import * as v from "valibot";
import { AuthenticationError } from "../../auth/errors.js";
import { logoutSession } from "../../auth/logout.js";
import { signInWithEmail } from "../../auth/signin.js";
import { verifySession } from "../../auth/verify.js";
import prisma from "../../db/prisma.js";

export const authRouter = Router();
const verificationSchema = v.object({
	token: v.pipe(v.string(), v.minLength(1), v.maxLength(8192)),
	tenantApplicationKey: v.pipe(v.string(), v.minLength(2)),
	mode: v.optional(v.picklist(["JWT", "COOKIE"]), "JWT"),
});
authRouter.use((_request, response, next) => {
	response.setHeader("Cache-Control", "no-store");
	next();
});
authRouter.post("/signin", async (request, response) => {
	const { tenantApplicationKey, mode } = v.parse(v.omit(verificationSchema, ["token"]), request.body);
	const application = await prisma.tenantApplication.findUnique({ where: { key: tenantApplicationKey } });
	if (!application || application.sessionStrategy !== mode) throw new AuthenticationError("Invalid session mode");
	response.json(await signInWithEmail(request.body));
});
authRouter.post("/verify", async (request, response) => {
	const { token, tenantApplicationKey, mode } = v.parse(verificationSchema, request.body);
	response.json(await verifySession(token, tenantApplicationKey, mode));
});
authRouter.post("/logout", async (request, response) => {
	const { token, tenantApplicationKey, mode } = v.parse(verificationSchema, request.body);
	await logoutSession(token, tenantApplicationKey, mode);
	response.sendStatus(204);
});
