import { errors, jwtVerify } from "jose";
import prisma from "../db/prisma.js";
import { AuthenticationError } from "./errors.js";
import { hashSessionToken, jwtSecret } from "./utils.js";

export async function verifySession(token: string, tenantApplicationKey: string, mode: "JWT" | "COOKIE" = "JWT") {
	if (mode === "JWT") {
		const secret = jwtSecret();
		try {
			await jwtVerify(token, secret, {
				algorithms: ["HS256"],
				issuer: "company-auth",
				audience: tenantApplicationKey,
				typ: "JWT",
				requiredClaims: ["exp", "iat", "jti"],
			});
		} catch (error) {
			if (error instanceof errors.JOSEError) throw new AuthenticationError("Invalid session");
			throw error;
		}
	}
	const session = await prisma.session.findUnique({
		where: { tokenHash: hashSessionToken(token) },
		include: { tenantApplicationUser: { include: { tenantApplication: true } } },
	});
	if (!session || session.strategy !== mode || session.expiresAt.getTime() <= Date.now())
		throw new AuthenticationError("Invalid session");
	const membership = session.tenantApplicationUser;
	if (
		membership.tenantApplication.key !== tenantApplicationKey ||
		membership.tenantApplication.sessionStrategy !== mode
	)
		throw new AuthenticationError("Invalid session");
	return {
		userId: membership.userId,
		tenantId: membership.tenantId,
		tenantApplicationId: membership.tenantApplicationId,
		membershipId: membership.id,
		sessionId: session.id,
	};
}
