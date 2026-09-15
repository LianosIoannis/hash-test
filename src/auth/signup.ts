import * as v from "valibot";
import { hashPassword } from "../argon2/index.js";
import { createMembership } from "../db/memberships/actions.js";
import { findTenantApplicationByKey } from "../db/tenant-applications/queries.js";
import { createUser } from "../db/users/actions.js";
import { type SignUpInput, signUpSchema } from "./models.js";

export async function signUpWithEmail(signUpInput: SignUpInput) {
	const { email, username, password, tenantId } = v.parse(signUpSchema, signUpInput);

	const passwordHash = await hashPassword(password);

	const user = await createUser(email, username, passwordHash, tenantId);

	return user;
}

export async function registerUserToApp(userId: number, tenantApplicationKey: string) {
	const tenantApplication = await findTenantApplicationByKey(tenantApplicationKey);

	if (!tenantApplication) {
		throw new Error("Tenant Application not found");
	}

	return createMembership(userId, tenantApplication.id);
}
