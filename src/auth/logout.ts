import prisma from "../db/prisma.js";
import type { SessionMode } from "../library/contracts.js";
import { AuthenticationError } from "./errors.js";
import { verifySession } from "./verify.js";

export async function logoutSession(token: string, tenantApplicationKey: string, mode: SessionMode) {
	const identity = await verifySession(token, tenantApplicationKey, mode);
	const result = await prisma.session.deleteMany({ where: { id: identity.sessionId } });
	if (result.count !== 1) throw new AuthenticationError("Invalid session");
}
