import * as v from "valibot";
import { hashPassword } from "../argon2/index.js";
import { createUser } from "../db/actions.js";
import { type SignUpInput, signUpSchema } from "./models.js";

export async function signUpWithEmail(signUpInput: SignUpInput) {
	const { email, username, password, tenantId } = v.parse(signUpSchema, signUpInput);

	const passwordHash = await hashPassword(password);

	const user = await createUser(email, username, passwordHash, tenantId);

	return user;
}
