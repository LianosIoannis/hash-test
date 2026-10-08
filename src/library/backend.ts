import { json, type RequestHandler, Router } from "express";
import * as v from "valibot";
import type { AuthIdentity } from "./contracts.js";

declare module "express-serve-static-core" {
	interface Request {
		auth?: AuthIdentity;
	}
}

export interface BackendAuthOptions {
	centralUrl: string;
	tenantApplicationKey: string;
	timeoutMs?: number;
}

const id = v.pipe(v.number(), v.integer(), v.minValue(1));
const identitySchema = v.object({ userId: id, tenantId: id, tenantApplicationId: id, membershipId: id, sessionId: id });
const sessionSchema = v.object({
	mode: v.literal("JWT"),
	jwt_token: v.pipe(v.string(), v.minLength(1)),
	expiresAt: v.pipe(v.string(), v.isoTimestamp()),
});
const signinSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
});

export function createBackendAuth(options: BackendAuthOptions) {
	const centralUrl = new URL(options.centralUrl);
	if (!["http:", "https:"].includes(centralUrl.protocol)) throw new Error("centralUrl must use HTTP or HTTPS");
	if (!options.tenantApplicationKey || options.tenantApplicationKey.length < 2)
		throw new Error("A tenant application key is required");
	const timeoutMs = options.timeoutMs ?? 5000;
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("timeoutMs must be a positive integer");
	const tenantApplicationKey = options.tenantApplicationKey;
	async function central(path: string, body: unknown) {
		return fetch(new URL(`/api/auth/${path}`, centralUrl), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
			redirect: "error",
		});
	}
	const router = Router();
	router.use(json({ limit: "16kb" }));
	router.use((_request, response, next) => {
		response.setHeader("Cache-Control", "no-store");
		next();
	});
	router.post("/signin", async (request, response) => {
		const input = v.safeParse(signinSchema, request.body);
		if (!input.success) {
			response.status(400).json({ error: "Invalid sign-in input" });
			return;
		}
		try {
			const upstream = await central("signin", { ...input.output, tenantApplicationKey });
			if (!upstream.ok) {
				response.status(upstream.status === 401 ? 401 : 503).json({ error: "Sign-in failed" });
				return;
			}
			const session = v.safeParse(sessionSchema, await upstream.json());
			if (!session.success) throw new Error("Invalid central sign-in response");
			response.json(session.output);
		} catch {
			response.status(503).json({ error: "Authentication service unavailable" });
		}
	});
	const authenticate: RequestHandler = async (request, response, next) => {
		delete request.auth;
		response.setHeader("Cache-Control", "no-store");
		const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? "");
		if (!match?.[1] || match[1].length > 8192) {
			response.status(401).json({ error: "Invalid session" });
			return;
		}
		try {
			const upstream = await central("verify", { token: match[1], tenantApplicationKey });
			if (!upstream.ok) {
				response
					.status(upstream.status === 401 || upstream.status === 400 ? 401 : 503)
					.json({ error: "Session verification failed" });
				return;
			}
			const identity = v.safeParse(identitySchema, await upstream.json());
			if (!identity.success) throw new Error("Invalid central verification response");
			request.auth = identity.output;
		} catch {
			response.status(503).json({ error: "Authentication service unavailable" });
			return;
		}
		next();
	};
	return { router, authenticate };
}
