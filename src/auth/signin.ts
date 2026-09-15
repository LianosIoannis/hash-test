import * as v from "valibot";
import { verifyPassword } from "../argon2/index.js";
import { findTenantApplicationUser } from "../db/memberships/queries.js";
import { findTenantApplicationByKey } from "../db/tenant-applications/queries.js";
import { findUserByEmail, findUserByUsername } from "../db/users/queries.js";
import {
	type AuthenticateWithEmailInput,
	type AuthenticateWithUsernameInput,
	authenticateWithEmailSchema,
	authenticateWithUsernameSchema,
	type SignInWithEmailInput,
	type SignInWithUsernameInput,
	signInWithEmailSchema,
	signInWithUsernameSchema,
} from "./models.js";
import { issueSession } from "./utils.js";

export async function authenticateWithEmail(authenticateWithEmailInput: AuthenticateWithEmailInput) {
	const { email, password, tenantId } = v.parse(authenticateWithEmailSchema, authenticateWithEmailInput);

	const user = await findUserByEmail(email, tenantId);

	if (!user) {
		throw new Error("Invalid Credentials");
	}

	const isPasswordValid = await verifyPassword(password, user.passwordHash);

	if (!isPasswordValid) {
		throw new Error("Invalid Credentials");
	}

	return user;
}

export async function authenticateWithUsername(authenticateWithUsernameInput: AuthenticateWithUsernameInput) {
	const { username, password, tenantId } = v.parse(authenticateWithUsernameSchema, authenticateWithUsernameInput);

	const user = await findUserByUsername(username, tenantId);

	if (!user) {
		throw new Error("Invalid Credentials");
	}

	const isPasswordValid = await verifyPassword(password, user.passwordHash);

	if (!isPasswordValid) {
		throw new Error("Invalid Credentials");
	}

	return user;
}

export async function loginUserToApp(userId: number, tenantApplicationKey: string) {
	const tenantApplicationUser = await findTenantApplicationUser(userId, tenantApplicationKey);

	if (!tenantApplicationUser) {
		throw new Error("Application access denied");
	}

	return issueSession(tenantApplicationUser.id);
}

export async function signInWithEmail(signInWithEmailInput: SignInWithEmailInput) {
	const { email, password, tenantApplicationKey } = v.parse(signInWithEmailSchema, signInWithEmailInput);

	const tenantApplication = await findTenantApplicationByKey(tenantApplicationKey);

	if (!tenantApplication) {
		throw new Error("Invalid Credentials");
	}

	const user = await authenticateWithEmail({
		email,
		password,
		tenantId: tenantApplication.tenantId,
	});

	return loginUserToApp(user.id, tenantApplicationKey);
}

export async function signInWithUsername(signInWithUsernameInput: SignInWithUsernameInput) {
	const { username, password, tenantApplicationKey } = v.parse(signInWithUsernameSchema, signInWithUsernameInput);

	const tenantApplication = await findTenantApplicationByKey(tenantApplicationKey);

	if (!tenantApplication) {
		throw new Error("Invalid Credentials");
	}

	const user = await authenticateWithUsername({
		username,
		password,
		tenantId: tenantApplication.tenantId,
	});

	return loginUserToApp(user.id, tenantApplicationKey);
}
