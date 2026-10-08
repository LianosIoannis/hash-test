import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

export function readCookie(request: Request, name: string) {
	const entries = (request.headers.cookie ?? "").split(";").map((entry) => entry.trim());
	const matches = entries.filter((entry) => entry.startsWith(`${name}=`));
	if (matches.length !== 1) return undefined;
	const value = matches[0]?.slice(name.length + 1);
	return value && value.length <= 8192 ? value : undefined;
}

export function createCookieProtection(options: {
	tenantApplicationKey: string;
	publicOrigin?: string;
	allowInsecureCookies?: boolean;
}) {
	if (!options.publicOrigin) throw new Error("COOKIE mode requires publicOrigin");
	const origin = new URL(options.publicOrigin);
	if (origin.origin !== options.publicOrigin || !["http:", "https:"].includes(origin.protocol))
		throw new Error("publicOrigin must be an HTTP or HTTPS origin");
	const insecure = options.allowInsecureCookies === true;
	if (insecure && (origin.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
		throw new Error("Insecure cookies require a loopback HTTP origin");
	if (origin.protocol === "http:" && !insecure)
		throw new Error("HTTP cookie mode requires the explicit loopback exception");
	const secure = !insecure;
	const scope = createHash("sha256").update(options.tenantApplicationKey).digest("hex");
	const prefix = secure ? "__Host-" : "";
	const sessionName = `${prefix}company-auth-${scope}`;
	const csrfName = `${prefix}company-csrf-${scope}`;
	const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
	const signingKey = randomBytes(32);
	const sign = (nonce: string) => createHmac("sha256", signingKey).update(nonce).digest("base64url");
	function valid(token: string) {
		if (!/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
		const [nonce, signature] = token.split(".");
		return !!nonce && !!signature && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(nonce)));
	}
	const protect: RequestHandler = (request, response, next) => {
		if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
			next();
			return;
		}
		const token = request.get("X-CSRF-Token");
		const cookie = readCookie(request, csrfName);
		if (
			request.get("Origin") !== origin.origin ||
			!token ||
			!cookie ||
			!valid(token) ||
			!valid(cookie) ||
			token.length !== cookie.length ||
			!timingSafeEqual(Buffer.from(token), Buffer.from(cookie))
		) {
			response.status(403).json({ error: "Invalid CSRF proof" });
			return;
		}
		next();
	};
	return {
		protect,
		bootstrap(request: Request, response: Response) {
			const existing = readCookie(request, csrfName);
			if (existing && valid(existing)) {
				response.json({ csrfToken: existing });
				return;
			}
			const nonce = randomBytes(32).toString("base64url");
			const csrfToken = `${nonce}.${sign(nonce)}`;
			response.cookie(csrfName, csrfToken, cookieOptions).json({ csrfToken });
		},
		readSession: (request: Request) => readCookie(request, sessionName),
		setSession(response: Response, token: string, expiresAt: string) {
			response.cookie(sessionName, token, { ...cookieOptions, expires: new Date(expiresAt) });
		},
		clearSession(response: Response) {
			response.clearCookie(sessionName, cookieOptions);
		},
	};
}
