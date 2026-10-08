import type { BrowserSession, SessionMode } from "./contracts.js";

export class AuthClientError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "AuthClientError";
	}
}

export function createAuthClient(options: {
	tenantApplicationKey: string;
	basePath?: string;
	sessionMode?: SessionMode;
}) {
	const mode = options.sessionMode ?? "JWT";
	if (mode !== "JWT" && mode !== "COOKIE") throw new Error("Invalid sessionMode");
	const basePath = options.basePath ?? "/auth";
	const baseUrl = new URL(`${basePath.replace(/\/$/, "")}/`, window.location.origin);
	if (baseUrl.origin !== window.location.origin) throw new Error("Authentication endpoints must be same-origin");
	const storageKey = `company-auth:${options.tenantApplicationKey}:${baseUrl.pathname}`;
	function getToken() {
		return mode === "JWT" ? window.sessionStorage.getItem(storageKey) : null;
	}
	let pendingCsrf: Promise<string> | undefined;
	async function loadCsrf() {
		const response = await fetch(new URL("csrf", baseUrl), {
			credentials: "same-origin",
			redirect: "error",
			cache: "no-store",
		});
		if (!response.ok) throw new AuthClientError(response.status, "CSRF bootstrap failed");
		const proof: unknown = await response.json();
		if (
			!proof ||
			typeof proof !== "object" ||
			!("csrfToken" in proof) ||
			typeof proof.csrfToken !== "string" ||
			!/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(proof.csrfToken)
		)
			throw new Error("Invalid CSRF response");
		return proof.csrfToken;
	}
	async function csrfHeaders(headers: Headers) {
		if (mode !== "COOKIE") return;
		pendingCsrf ??= loadCsrf().finally(() => {
			pendingCsrf = undefined;
		});
		headers.set("X-CSRF-Token", await pendingCsrf);
	}
	async function signIn(email: string, password: string): Promise<BrowserSession> {
		const headers = new Headers({ "Content-Type": "application/json" });
		await csrfHeaders(headers);
		const response = await fetch(new URL("signin", baseUrl), {
			method: "POST",
			headers,
			body: JSON.stringify({ email, password }),
			credentials: "same-origin",
			redirect: "error",
		});
		if (!response.ok) throw new AuthClientError(response.status, "Sign-in failed");
		const session: unknown = await response.json();
		if (
			typeof session !== "object" ||
			session === null ||
			!("mode" in session) ||
			session.mode !== mode ||
			!("expiresAt" in session) ||
			typeof session.expiresAt !== "string" ||
			!Number.isFinite(Date.parse(session.expiresAt))
		)
			throw new Error("Invalid sign-in response");
		if (session.mode === "COOKIE") return { mode: "COOKIE", expiresAt: session.expiresAt };
		if (!("jwt_token" in session) || typeof session.jwt_token !== "string" || !session.jwt_token)
			throw new Error("Invalid sign-in response");
		window.sessionStorage.setItem(storageKey, session.jwt_token);
		return { mode: "JWT", jwt_token: session.jwt_token, expiresAt: session.expiresAt };
	}
	async function request(path: string, init: RequestInit = {}) {
		const url = new URL(path, window.location.origin);
		if (url.origin !== window.location.origin) throw new Error("Authenticated requests must be same-origin");
		const headers = new Headers(init.headers);
		const token = getToken();
		if (token) headers.set("Authorization", `Bearer ${token}`);
		else headers.delete("Authorization");
		if (!["GET", "HEAD", "OPTIONS"].includes((init.method ?? "GET").toUpperCase())) await csrfHeaders(headers);
		const response = await fetch(url, { ...init, headers, credentials: "same-origin", redirect: "error" });
		if (response.status === 401 && mode === "JWT") window.sessionStorage.removeItem(storageKey);
		return response;
	}
	async function logout(): Promise<void> {
		try {
			const response = await request(new URL("logout", baseUrl).href, { method: "POST" });
			if (response.status !== 204)
				throw new AuthClientError(response.status, "Logout failed; central invalidation was not confirmed");
		} finally {
			if (mode === "JWT") window.sessionStorage.removeItem(storageKey);
		}
	}
	return { signIn, request, getToken, logout };
}
