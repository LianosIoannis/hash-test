import { json, type Request, type RequestHandler, Router } from "express";
import * as v from "valibot";
import type { AuthIdentity, SessionMode } from "./contracts.js";
import { createCookieProtection } from "./cookie-protection.js";

declare module "express-serve-static-core" {
	interface Request {
		auth?: AuthIdentity;
	}
}

export interface BackendAuthOptions {
	centralUrl: string;
	tenantApplicationKey: string;
	timeoutMs?: number;
	sessionMode?: SessionMode;
	publicOrigin?: string;
	allowInsecureCookies?: boolean;
}

const id = v.pipe(v.number(), v.integer(), v.minValue(1));
const identitySchema = v.object({ userId: id, tenantId: id, tenantApplicationId: id, membershipId: id, sessionId: id });
const sessionSchema = v.object({
	mode: v.literal("JWT"),
	jwt_token: v.pipe(v.string(), v.minLength(1)),
	expiresAt: v.pipe(v.string(), v.isoTimestamp()),
});
const cookieSessionSchema = v.object({
	mode: v.literal("COOKIE"),
	session_token: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/)),
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
	const mode = options.sessionMode ?? "JWT";
	if (mode !== "JWT" && mode !== "COOKIE") throw new Error("Invalid sessionMode");
	const cookies = mode === "COOKIE" ? createCookieProtection(options) : undefined;
	function sessionToken(request: Request) {
		const token = cookies
			? cookies.readSession(request)
			: /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? "")?.[1];
		return token && token.length <= 8192 ? token : undefined;
	}
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
	if (cookies) {
		router.get("/csrf", cookies.bootstrap);
		router.use(cookies.protect);
	}
	router.post("/signin", async (request, response) => {
		const input = v.safeParse(signinSchema, request.body);
		if (!input.success) {
			response.status(400).json({ error: "Invalid sign-in input" });
			return;
		}
		try {
			const upstream = await central("signin", { ...input.output, tenantApplicationKey, mode });
			if (!upstream.ok) {
				response.status(upstream.status === 401 ? 401 : 503).json({
					error: upstream.status === 401 ? "Invalid sign-in credentials" : "Authentication service unavailable",
				});
				return;
			}
			const session = v.safeParse(v.union([sessionSchema, cookieSessionSchema]), await upstream.json());
			if (!session.success) throw new Error("Invalid central sign-in response");
			if (session.output.mode !== mode) throw new Error("Central session mode mismatch");
			if (session.output.mode === "COOKIE" && cookies) {
				cookies.setSession(response, session.output.session_token, session.output.expiresAt);
				response.json({ mode: "COOKIE", expiresAt: session.output.expiresAt });
			} else response.json(session.output);
		} catch {
			response.status(503).json({ error: "Authentication service unavailable" });
		}
	});
	router.post("/logout", async (request, response) => {
		const token = sessionToken(request);
		// CSRF rejection runs before this handler and must preserve the cookie.
		cookies?.clearSession(response);
		if (!token) {
			response.status(401).json({ error: "Invalid session" });
			return;
		}
		try {
			const upstream = await central("logout", { token, tenantApplicationKey, mode });
			if (upstream.status === 204) {
				response.sendStatus(204);
				return;
			}
			response
				.status(upstream.status === 401 || upstream.status === 400 ? 401 : 503)
				.json({ error: "Central logout failed" });
		} catch {
			response.status(503).json({ error: "Central logout failed" });
		}
	});
	const authenticate: RequestHandler = async (request, response, next) => {
		delete request.auth;
		response.setHeader("Cache-Control", "no-store");
		const token = sessionToken(request);
		if (!token) {
			response.status(401).json({ error: "Invalid session" });
			return;
		}
		try {
			const upstream = await central("verify", { token, tenantApplicationKey, mode });
			if (!upstream.ok) {
				const invalid = upstream.status === 401 || upstream.status === 400;
				response
					.status(invalid ? 401 : 503)
					.json({ error: invalid ? "Invalid session" : "Authentication service unavailable" });
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
	const protectedAuthenticate: RequestHandler = cookies
		? (request, response, next) =>
				cookies.protect(request, response, () => {
					void authenticate(request, response, next);
				})
		: authenticate;
	return { router, authenticate: protectedAuthenticate };
}
