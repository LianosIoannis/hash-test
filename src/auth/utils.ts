import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import prisma from "../db/prisma.js";
import { AuthenticationError } from "./errors.js";

export function hashSessionToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

export function jwtSecret() {
	const secret = process.env.JWT_SECRET;
	if (!secret || new TextEncoder().encode(secret).length < 32)
		throw new Error("JWT_SECRET must contain at least 32 bytes");
	return new TextEncoder().encode(secret);
}

export async function issueSession(membershipId: number) {
	const secret = jwtSecret();
	return prisma.$transaction(async (tx) => {
		const membership = await tx.tenantApplicationUser.findUniqueOrThrow({
			where: { id: membershipId },
			include: { tenantApplication: true },
		});
		if (membership.tenantApplication.sessionStrategy !== "JWT")
			throw new AuthenticationError("Session strategy is not supported yet");
		const issuedAt = Math.floor(Date.now() / 1000);
		const expiresAt = new Date((issuedAt + 7200) * 1000);
		const jwt_token = await new SignJWT({})
			.setProtectedHeader({ alg: "HS256", typ: "JWT" })
			.setIssuer("company-auth")
			.setAudience(membership.tenantApplication.key)
			.setJti(randomUUID())
			.setIssuedAt(issuedAt)
			.setExpirationTime(issuedAt + 7200)
			.sign(secret);
		await tx.session.create({
			data: {
				tokenHash: hashSessionToken(jwt_token),
				tenantApplicationUserId: membershipId,
				expiresAt,
				strategy: "JWT",
			},
		});
		return { mode: "JWT" as const, jwt_token, expiresAt };
	});
}
