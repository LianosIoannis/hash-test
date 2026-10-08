import { Router } from "express";
import * as v from "valibot";
import { signInWithEmail } from "../../auth/signin.js";
import { verifySession } from "../../auth/verify.js";

export const authRouter = Router();
const verificationSchema = v.object({
	token: v.pipe(v.string(), v.minLength(1), v.maxLength(8192)),
	tenantApplicationKey: v.pipe(v.string(), v.minLength(2)),
});
authRouter.use((_request, response, next) => {
	response.setHeader("Cache-Control", "no-store");
	next();
});
authRouter.post("/signin", async (request, response) => {
	response.json(await signInWithEmail(request.body));
});
authRouter.post("/verify", async (request, response) => {
	const { token, tenantApplicationKey } = v.parse(verificationSchema, request.body);
	response.json(await verifySession(token, tenantApplicationKey));
});
