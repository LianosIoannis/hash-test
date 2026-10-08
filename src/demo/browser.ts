import { createAuthClient } from "../library/browser.js";
import type { SessionMode } from "../library/contracts.js";

const configResponse = await fetch(new URL("config", window.location.href));
const config: { tenantApplicationKey: string; sessionMode: SessionMode; basePath: string; applicationPath: string } =
	await configResponse.json();
const auth = createAuthClient(config);
const form = document.querySelector<HTMLFormElement>("#signin");
const result = document.querySelector<HTMLElement>("#result");
const identityButton = document.querySelector<HTMLButtonElement>("#identity");
if (!form || !result || !identityButton) throw new Error("Demo elements are missing");
async function showIdentity(initial = false) {
	const response = await auth.request(`${config.applicationPath}/identity`);
	if (result)
		result.textContent = response.ok
			? JSON.stringify(await response.json(), null, 2)
			: initial && response.status === 401
				? "Sign in to access your identity"
				: `Request failed (${response.status})`;
}
form.addEventListener("submit", async (event) => {
	event.preventDefault();
	try {
		const data = new FormData(form);
		await auth.signIn(String(data.get("email")), String(data.get("password")));
		await showIdentity();
	} catch (error) {
		result.textContent = error instanceof Error ? error.message : "Sign-in failed";
	}
});
identityButton.addEventListener("click", () => {
	void showIdentity().catch(() => {
		result.textContent = "Request failed";
	});
});
document.querySelector("#mutation")?.addEventListener("click", async () => {
	const output = document.querySelector("#mutation-result");
	if (!output) return;
	try {
		const response = await auth.request(`${config.applicationPath}/mutation`, { method: "POST" });
		output.textContent = response.ok ? JSON.stringify(await response.json()) : `Request failed (${response.status})`;
	} catch {
		output.textContent = "Request failed";
	}
});
if (auth.getToken() || config.sessionMode === "COOKIE") await showIdentity(true);
else result.textContent = "Sign in to access your identity";
