import { ApiError, get, patch, post, put } from "./api/client.js";
import type { AppStrategy, AzureConfig } from "./sso-types.js";
import type { TenantApplication } from "./types.js";

function message(error: unknown) {
	if (error instanceof ApiError && error.issues[0]) {
		const issue = error.issues[0];
		return (issue.path ? issue.path + ": " : "") + issue.message;
	}
	return error instanceof Error ? error.message : "Unable to save";
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
	return node;
}
function modal(title: string, onSaved: () => Promise<void>) {
	const dialog = element("dialog");
	const form = element("form");
	const heading = element("div");
	heading.className = "dialog-heading";
	heading.append(element("h2", title));
	const body = element("div");
	body.className = "form-fields";
	const error = element("p");
	error.className = "form-error";
	error.setAttribute("role", "alert");
	const actions = element("div");
	actions.className = "dialog-actions";
	const cancel = element("button", "Cancel");
	cancel.type = "button";
	cancel.className = "secondary-button";
	cancel.onclick = () => dialog.close();
	const submit = element("button", "Save");
	submit.type = "submit";
	submit.className = "primary-button";
	actions.append(cancel, submit);
	form.append(heading, body, error, actions);
	dialog.append(form);
	dialog.addEventListener("close", () => dialog.remove());
	document.body.append(dialog);
	dialog.showModal();
	return {
		body,
		save(handler: () => Promise<unknown>) {
			form.onsubmit = async (event) => {
				event.preventDefault();
				submit.disabled = true;
				error.textContent = "";
				try {
					await handler();
					form.reset();
					dialog.close();
					await onSaved();
				} catch (failure) {
					error.textContent = message(failure);
				} finally {
					submit.disabled = false;
				}
			};
		},
	};
}
function field(container: HTMLElement, title: string, value = "", required = true, type = "text") {
	const label = element("label");
	label.className = "form-field";
	label.append(element("span", title));
	const input = element("input");
	input.type = type;
	input.value = value;
	input.required = required;
	if (type === "password") input.autocomplete = "new-password";
	label.append(input);
	container.append(label);
	return input;
}
function check(container: HTMLElement, title: string, checked: boolean) {
	const input = field(container, title, "", false, "checkbox");
	input.checked = checked;
	return input;
}
function select(container: HTMLElement, title: string, options: { value: string; label: string }[]) {
	const label = element("label");
	label.className = "form-field";
	label.append(element("span", title));
	const input = element("select");
	for (const option of options) {
		const node = element("option", option.label);
		node.value = option.value;
		input.append(node);
	}
	input.required = true;
	label.append(input);
	container.append(label);
	return input;
}
function configFields(container: HTMLElement, strategy: string, config?: AzureConfig | null) {
	const name = field(container, "Configuration name (globally unique)", config?.name);
	const description = field(container, "Description", config?.description ?? "", false);
	const directoryTenantId = field(container, "Microsoft directory tenant ID", config?.directoryTenantId);
	const clientId = field(container, "Client ID", config?.clientId);
	const redirectUri = field(container, "Redirect URI", config?.redirectUri, true, "url");
	const scopes = field(container, "Scopes", config?.scopes ?? "openid profile email");
	const server = strategy === "AZURE_SSO_SERVER";
	const secret = field(
		container,
		config?.hasClientSecret
			? "Client secret — leave blank to keep existing"
			: "Client secret" + (server ? " (required)" : " (optional)"),
		"",
		server && !config?.hasClientSecret,
		"password",
	);
	const clear = !server && config?.hasClientSecret ? check(container, "Remove stored client secret", false) : null;
	if (clear)
		clear.onchange = () => {
			secret.disabled = clear.checked;
			if (clear.checked) secret.value = "";
		};
	const help = element(
		"p",
		server
			? "The secret is stored as entered and is never returned to this screen."
			: "SPA applications do not require a client secret.",
	);
	help.className = "form-help";
	container.append(help);
	return () => ({
		name: name.value,
		description: description.value || null,
		directoryTenantId: directoryTenantId.value,
		clientId: clientId.value,
		redirectUri: redirectUri.value,
		scopes: scopes.value,
		...(clear?.checked ? { clientSecret: null } : secret.value ? { clientSecret: secret.value } : {}),
	});
}

export async function openAzureForm(config: AzureConfig | undefined, onSaved: () => Promise<void>) {
	const apps = config ? [] : await get<TenantApplication[]>("/tenant-applications");
	const ui = modal(config ? "Edit Azure SSO configuration" : "Add Azure SSO configuration", onSaved);
	let app: HTMLSelectElement | undefined;
	let strategy: HTMLSelectElement | undefined;
	let enabled: HTMLInputElement | undefined;
	if (!config) {
		app = select(ui.body, "Tenant application", [
			{ value: "", label: "Select a tenant application" },
			...apps.map((item) => ({
				value: String(item.id),
				label: (item.tenant?.name ?? item.tenantId) + " / " + (item.application?.name ?? item.applicationId),
			})),
		]);
		strategy = select(ui.body, "Azure strategy", [
			{ value: "AZURE_SSO_SERVER", label: "Azure SSO — server" },
			{ value: "AZURE_SSO_CLIENT", label: "Azure SSO — client" },
		]);
		enabled = check(ui.body, "Enable this strategy after saving", true);
	} else {
		const target = config.tenantApplicationStrategy;
		ui.body.append(
			element(
				"p",
				target
					? target.tenantApplication.tenant.name +
							" / " +
							target.tenantApplication.application.name +
							" — " +
							target.strategy
					: "Azure configuration",
			),
		);
	}
	const fields = element("div");
	fields.className = "sso-fields";
	ui.body.append(fields);
	let read = configFields(fields, config?.tenantApplicationStrategy?.strategy ?? "AZURE_SSO_SERVER", config);
	if (strategy)
		strategy.onchange = () => {
			fields.replaceChildren();
			read = configFields(fields, strategy?.value ?? "AZURE_SSO_SERVER");
		};
	ui.save(async () => {
		if (config) return patch("/azure-sso-configs/" + config.id, read());
		return post("/azure-sso-configs", {
			...read(),
			tenantApplicationId: Number(app?.value),
			strategy: strategy?.value,
			enabled: enabled?.checked,
		});
	});
}

export async function openStrategies(app: TenantApplication, onSaved: () => Promise<void>) {
	const [codes, records] = await Promise.all([
		get<string[]>("/authentication-strategies"),
		get<AppStrategy[]>("/tenant-applications/" + app.id + "/strategies"),
	]);
	const ui = modal("Authentication strategies", onSaved);
	ui.body.append(
		element("p", (app.tenant?.name ?? app.tenantId) + " / " + (app.application?.name ?? app.applicationId)),
	);
	const info = element(
		"p",
		"Configure allowed login methods. Selecting a method changes which strategy you are editing.",
	);
	info.className = "form-help";
	ui.body.append(info);
	const strategy = select(
		ui.body,
		"Strategy",
		codes.map((code) => ({
			value: code,
			label:
				code.replaceAll("_", " ") +
				(records.find((item) => item.strategy === code)?.enabled ? " — enabled" : " — disabled"),
		})),
	);
	const enabled = check(ui.body, "Enabled", false);
	const fields = element("div");
	fields.className = "sso-fields";
	ui.body.append(fields);
	let read: ReturnType<typeof configFields> | undefined;
	const render = () => {
		fields.replaceChildren();
		read = undefined;
		const record = records.find((item) => item.strategy === strategy.value);
		if (enabled.checked && strategy.value.startsWith("AZURE_SSO_")) {
			read = configFields(fields, strategy.value, record?.azureSsoConfig);
		}
	};
	strategy.onchange = () => {
		enabled.checked = records.find((item) => item.strategy === strategy.value)?.enabled ?? false;
		render();
	};
	enabled.onchange = render;
	enabled.checked = records.find((item) => item.strategy === strategy.value)?.enabled ?? false;
	render();
	ui.save(() =>
		put("/tenant-applications/" + app.id + "/strategies/" + strategy.value, {
			enabled: enabled.checked,
			...(read ? { azureSsoConfig: read() } : {}),
		}),
	);
}
