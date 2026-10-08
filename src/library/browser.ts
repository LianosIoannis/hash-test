import type { JwtSession } from "./contracts.js";

export class AuthClientError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "AuthClientError";
	}
}

export function createAuthClient(options: { tenantApplicationKey: string; basePath?: string }) {
	const basePath = options.basePath ?? "/auth";
	const baseUrl = new URL(`${basePath.replace(/\/$/, "")}/`, window.location.origin);
	if (baseUrl.origin !== window.location.origin) throw new Error("Authentication endpoints must be same-origin");
	const storageKey = `company-auth:${options.tenantApplicationKey}:${baseUrl.pathname}`;
	function getToken() {
		return window.sessionStorage.getItem(storageKey);
	}
	async function signIn(email: string, password: string): Promise<JwtSession> {
		const response = await fetch(new URL("signin", baseUrl), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
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
			session.mode !== "JWT" ||
			!("jwt_token" in session) ||
			typeof session.jwt_token !== "string" ||
			!session.jwt_token ||
			!("expiresAt" in session) ||
			typeof session.expiresAt !== "string" ||
			!Number.isFinite(Date.parse(session.expiresAt))
		)
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
		const response = await fetch(url, { ...init, headers, credentials: "same-origin", redirect: "error" });
		if (response.status === 401) window.sessionStorage.removeItem(storageKey);
		return response;
	}
	return { signIn, request, getToken };
}
