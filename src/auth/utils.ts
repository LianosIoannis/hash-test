import "dotenv/config";
import { createHash } from "node:crypto";
import { addHours } from "date-fns";
import { SignJWT } from "jose";
import { nanoid } from "nanoid";
import { createSession } from "../db/sessions/actions.js";

function hashSessionToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

async function createJwt(tenantApplicationUserId: number) {
	const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET);

	return new SignJWT({
		tenantApplicationUserId,
	})
		.setProtectedHeader({
			alg: "HS256",
			typ: "JWT",
		})
		.setIssuedAt()
		.setExpirationTime("2h")
		.sign(jwtSecret);
}

export async function issueSession(tenantApplicationUserId: number) {
	const session_token = nanoid(32);
	const tokenHash = hashSessionToken(session_token);

	const expiresAt = addHours(new Date(), 2);

	await createSession(tokenHash, tenantApplicationUserId, expiresAt);

	const jwt_token = await createJwt(tenantApplicationUserId);

	return {
		session_token,
		jwt_token,
		expiresAt,
	};
}
