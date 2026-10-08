import "dotenv/config";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import prisma from "../db/prisma.js";

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
	return prisma.$transaction(async (tx) => {
		const membership = await tx.tenantApplicationUser.findUniqueOrThrow({
			where: { id: membershipId },
			include: { tenantApplication: true },
		});
		const issuedAt = Math.floor(Date.now() / 1000);
		const expiresAt = new Date((issuedAt + 7200) * 1000);
		const mode = membership.tenantApplication.sessionStrategy;
		const token =
			mode === "COOKIE"
				? randomBytes(32).toString("base64url")
				: await new SignJWT({})
						.setProtectedHeader({ alg: "HS256", typ: "JWT" })
						.setIssuer("company-auth")
						.setAudience(membership.tenantApplication.key)
						.setJti(randomUUID())
						.setIssuedAt(issuedAt)
						.setExpirationTime(issuedAt + 7200)
						.sign(jwtSecret());
		await tx.session.create({
			data: {
				tokenHash: hashSessionToken(token),
				tenantApplicationUserId: membershipId,
				expiresAt,
				strategy: mode,
			},
		});
		return mode === "COOKIE" ? { mode, session_token: token, expiresAt } : { mode, jwt_token: token, expiresAt };
	});
}
