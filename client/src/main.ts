import "./styles.css";
import { ApiError, get, patch, post, put, remove } from "./api/client.js";
import type { Application, Membership, Overview, Session, Tenant, TenantApplication, User } from "./types.js";

type ResourceName = "tenants" | "applications" | "tenant-applications" | "users" | "memberships" | "sessions";
type RecordValue = Tenant | Application | TenantApplication | User | Membership | Session;
type FormValue = string | number | null;

type Option = { label: string; value: number | string };
type Field = {
	name: string;
	label: string;
	type?: "text" | "email" | "password" | "textarea" | "select";
	required?: boolean;
	nullable?: boolean;
	options?: () => Promise<Option[]>;
};

type Column = {
	label: string;
	value: (record: never) => string | number;
	className?: string;
};

type ResourceConfig = {
	label: string;
	singular: string;
	description: string;
	columns: Column[];
	createFields?: Field[];
	editFields?: Field[];
	toEditValues?: (record: never) => Record<string, FormValue>;
	canChangePassword?: boolean;
};

function requiredElement<T extends Element>(selector: string): T {
	const element = document.querySelector<T>(selector);

	if (!element) {
		throw new Error(`Required interface element was not found: ${selector}`);
	}

	return element;
}

const appRoot = requiredElement<HTMLDivElement>("#app");

const icon = (name: string) => {
	const icons: Record<string, string> = {
		overview: '<path d="M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z"/>',
		tenants: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h6"/>',
		applications: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
		"tenant-applications": '<path d="M8 12h8M12 8v8"/><circle cx="12" cy="12" r="9"/>',
		users:
			'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
		memberships: '<path d="m9 12 2 2 4-4"/><path d="M12 22a10 10 0 1 0-9.5-7"/>',
		sessions: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
		refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-2L4 11m16 2-2 4a7 7 0 0 1-12-2"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
		trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
		key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 9-9 2 2-2 2 2 2-3 3-2-2-3 3"/>',
	};

	return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? ""}</svg>`;
};

appRoot.innerHTML = `
	<div class="shell">
		<aside class="sidebar">
			<div class="brand">
				<div class="brand-mark">A</div>
				<div><strong>Authbase</strong><span>Local admin</span></div>
			</div>
			<nav aria-label="Main navigation">
				<button class="nav-item active" data-view="overview">${icon("overview")}<span>Overview</span></button>
				<p class="nav-label">Database</p>
				<button class="nav-item" data-view="tenants">${icon("tenants")}<span>Tenants</span></button>
				<button class="nav-item" data-view="applications">${icon("applications")}<span>Applications</span></button>
				<button class="nav-item" data-view="tenant-applications">${icon("tenant-applications")}<span>Tenant apps</span></button>
				<button class="nav-item" data-view="users">${icon("users")}<span>Users</span></button>
				<button class="nav-item" data-view="memberships">${icon("memberships")}<span>Memberships</span></button>
				<button class="nav-item" data-view="sessions">${icon("sessions")}<span>Sessions</span></button>
			</nav>
			<div class="environment"><span></span><div><strong>Local environment</strong><small>127.0.0.1:3000</small></div></div>
		</aside>
		<main>
			<header class="topbar">
				<div><p>Authentication database</p><h1 id="page-title">Overview</h1></div>
				<button class="icon-button" id="refresh-button" title="Refresh current view">${icon("refresh")}</button>
			</header>
			<section id="content" aria-live="polite"></section>
		</main>
	</div>
	<dialog id="form-dialog"><form method="dialog" id="resource-form"></form></dialog>
	<div id="toast" role="status" aria-live="polite"></div>
`;

const content = requiredElement<HTMLElement>("#content");
const title = requiredElement<HTMLElement>("#page-title");
const dialog = requiredElement<HTMLDialogElement>("#form-dialog");
const form = requiredElement<HTMLFormElement>("#resource-form");
const toast = requiredElement<HTMLDivElement>("#toast");

let activeView: "overview" | ResourceName = "overview";
let loadSequence = 0;

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function showToast(message: string, tone: "success" | "error" = "success") {
	toast.textContent = message;
	toast.dataset.tone = tone;
	toast.classList.add("visible");
	window.setTimeout(() => toast.classList.remove("visible"), 3500);
}

function errorMessage(error: unknown) {
	if (error instanceof ApiError) {
		const issue = error.issues[0];
		return issue ? `${issue.path ? `${issue.path}: ` : ""}${issue.message}` : error.message;
	}

	return error instanceof Error ? error.message : "Something went wrong";
}

async function tenantOptions(): Promise<Option[]> {
	return (await get<Tenant[]>("/tenants")).map((tenant) => ({ label: tenant.name, value: tenant.id }));
}

async function applicationOptions(): Promise<Option[]> {
	return (await get<Application[]>("/applications")).map((application) => ({
		label: `${application.name} (${application.code})`,
		value: application.id,
	}));
}

async function userOptions(): Promise<Option[]> {
	return (await get<User[]>("/users")).map((user) => ({
		label: `${user.email} — ${user.tenant?.name ?? `Tenant ${user.tenantId}`}`,
		value: user.id,
	}));
}

async function tenantApplicationOptions(): Promise<Option[]> {
	return (await get<TenantApplication[]>("/tenant-applications")).map((item) => ({
		label: `${item.tenant?.name ?? item.tenantId} / ${item.application?.name ?? item.applicationId}`,
		value: item.id,
	}));
}

const resources: Record<ResourceName, ResourceConfig> = {
	tenants: {
		label: "Tenants",
		singular: "tenant",
		description: "Organizations that own users and application access.",
		columns: [
			{ label: "Name", value: (record: Tenant) => record.name, className: "primary-cell" },
			{ label: "Description", value: (record: Tenant) => record.description ?? "—" },
			{ label: "Users", value: (record: Tenant) => record._count?.users ?? 0 },
			{ label: "Apps", value: (record: Tenant) => record._count?.tenantApplications ?? 0 },
			{ label: "Created", value: (record: Tenant) => formatDate(record.createdAt) },
		] as Column[],
		createFields: [
			{ name: "name", label: "Name", required: true },
			{ name: "description", label: "Description", type: "textarea", nullable: true },
		],
		editFields: [
			{ name: "name", label: "Name", required: true },
			{ name: "description", label: "Description", type: "textarea", nullable: true },
		],
		toEditValues: (record: Tenant) => ({ name: record.name, description: record.description }),
	},
	applications: {
		label: "Applications",
		singular: "application",
		description: "Products that can be enabled independently for each tenant.",
		columns: [
			{ label: "Name", value: (record: Application) => record.name, className: "primary-cell" },
			{ label: "Code", value: (record: Application) => record.code, className: "mono" },
			{ label: "Description", value: (record: Application) => record.description ?? "—" },
			{ label: "Tenants", value: (record: Application) => record._count?.tenantApplications ?? 0 },
			{ label: "Created", value: (record: Application) => formatDate(record.createdAt) },
		] as Column[],
		createFields: [
			{ name: "name", label: "Name", required: true },
			{ name: "code", label: "Code", required: true },
			{ name: "description", label: "Description", type: "textarea", nullable: true },
		],
		editFields: [
			{ name: "name", label: "Name", required: true },
			{ name: "code", label: "Code", required: true },
			{ name: "description", label: "Description", type: "textarea", nullable: true },
		],
		toEditValues: (record: Application) => ({
			name: record.name,
			code: record.code,
			description: record.description,
		}),
	},
	"tenant-applications": {
		label: "Tenant applications",
		singular: "tenant application",
		description: "Application instances enabled for individual tenants.",
		columns: [
			{ label: "Tenant", value: (record: TenantApplication) => record.tenant?.name ?? record.tenantId },
			{
				label: "Application",
				value: (record: TenantApplication) => record.application?.name ?? record.applicationId,
				className: "primary-cell",
			},
			{ label: "Key", value: (record: TenantApplication) => record.key, className: "mono" },
			{ label: "Users", value: (record: TenantApplication) => record._count?.users ?? 0 },
			{ label: "Created", value: (record: TenantApplication) => formatDate(record.createdAt) },
		] as Column[],
		createFields: [
			{ name: "tenantId", label: "Tenant", type: "select", required: true, options: tenantOptions },
			{
				name: "applicationId",
				label: "Application",
				type: "select",
				required: true,
				options: applicationOptions,
			},
			{ name: "key", label: "Application key", required: true },
		],
		editFields: [{ name: "key", label: "Application key", required: true }],
		toEditValues: (record: TenantApplication) => ({ key: record.key }),
	},
	users: {
		label: "Users",
		singular: "user",
		description: "Tenant identities and their application membership totals.",
		columns: [
			{ label: "Email", value: (record: User) => record.email, className: "primary-cell" },
			{ label: "Username", value: (record: User) => record.username },
			{ label: "Tenant", value: (record: User) => record.tenant?.name ?? record.tenantId },
			{ label: "Apps", value: (record: User) => record._count?.applications ?? 0 },
			{ label: "Created", value: (record: User) => formatDate(record.createdAt) },
		] as Column[],
		createFields: [
			{ name: "tenantId", label: "Tenant", type: "select", required: true, options: tenantOptions },
			{ name: "email", label: "Email", type: "email", required: true },
			{ name: "username", label: "Username (defaults to email)" },
			{ name: "password", label: "Password", type: "password", required: true },
		],
		editFields: [
			{ name: "email", label: "Email", type: "email", required: true },
			{ name: "username", label: "Username", required: true },
		],
		toEditValues: (record: User) => ({ email: record.email, username: record.username }),
		canChangePassword: true,
	},
	memberships: {
		label: "Memberships",
		singular: "membership",
		description: "Links between tenant users and enabled applications.",
		columns: [
			{ label: "User", value: (record: Membership) => record.user?.email ?? record.userId, className: "primary-cell" },
			{
				label: "Tenant",
				value: (record: Membership) => record.tenantApplication?.tenant?.name ?? "—",
			},
			{
				label: "Application",
				value: (record: Membership) => record.tenantApplication?.application?.name ?? record.tenantApplicationId,
			},
			{ label: "Sessions", value: (record: Membership) => record._count?.sessions ?? 0 },
			{ label: "Created", value: (record: Membership) => formatDate(record.createdAt) },
		] as Column[],
		createFields: [
			{ name: "userId", label: "User", type: "select", required: true, options: userOptions },
			{
				name: "tenantApplicationId",
				label: "Tenant application",
				type: "select",
				required: true,
				options: tenantApplicationOptions,
			},
		],
	},
	sessions: {
		label: "Sessions",
		singular: "session",
		description: "Active and expired authentication sessions. Token hashes remain hidden.",
		columns: [
			{
				label: "User",
				value: (record: Session) =>
					record.tenantApplicationUser?.user.email ?? `Membership ${record.tenantApplicationUserId}`,
				className: "primary-cell",
			},
			{
				label: "Application",
				value: (record: Session) => record.tenantApplicationUser?.tenantApplication.application.name ?? "—",
			},
			{ label: "Created", value: (record: Session) => formatDate(record.createdAt) },
			{ label: "Expires", value: (record: Session) => formatDate(record.expiresAt) },
			{ label: "State", value: (record: Session) => (new Date(record.expiresAt) > new Date() ? "Active" : "Expired") },
		] as Column[],
	},
};

function setLoading() {
	content.innerHTML = `
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading database records…</p>
		</div>
	`;
}

function renderFailure(error: unknown) {
	content.innerHTML = "";
	const panel = document.createElement("div");
	panel.className = "empty-state error-state";
	panel.innerHTML = `<div class="empty-icon">!</div><h2>Unable to load data</h2>`;
	const message = document.createElement("p");
	message.textContent = errorMessage(error);
	panel.append(message);
	content.append(panel);
}

async function loadOverview(sequence: number) {
	const data = await get<Overview>("/overview");

	if (sequence !== loadSequence) return;

	const cards: Array<[string, number, string, ResourceName]> = [
		["Tenants", data.tenants, "Organizations", "tenants"],
		["Applications", data.applications, "Global products", "applications"],
		["Tenant apps", data.tenantApplications, "Enabled instances", "tenant-applications"],
		["Users", data.users, "Tenant identities", "users"],
		["Memberships", data.memberships, "Application grants", "memberships"],
		["Sessions", data.activeSessions, `${data.expiredSessions} expired`, "sessions"],
	];

	content.innerHTML = `
		<div class="page-intro"><div><span class="eyebrow">System snapshot</span><h2>Database at a glance</h2><p>Inspect identities, application access, and session activity.</p></div><span class="live-badge"><i></i> API connected</span></div>
		<div class="metric-grid"></div>
		<div class="notice"><div class="notice-icon">i</div><div><strong>Local inspection mode</strong><p>Authentication is disabled. Keep both the API and this interface on your local machine.</p></div></div>
	`;

	const grid = content.querySelector<HTMLDivElement>(".metric-grid");
	if (!grid) return;

	for (const [label, value, detail, view] of cards) {
		const card = document.createElement("button");
		card.className = "metric-card";
		card.innerHTML = `<span class="metric-icon">${icon(view)}</span><span class="metric-value">${value}</span><strong>${label}</strong><small>${detail}</small>`;
		card.addEventListener("click", () => navigate(view));
		grid.append(card);
	}
}

async function loadResource(name: ResourceName, sequence: number) {
	const config = resources[name];
	const records = await get<RecordValue[]>(`/${name}`);

	if (sequence !== loadSequence) return;

	content.innerHTML = "";
	const intro = document.createElement("div");
	intro.className = "page-intro";
	intro.innerHTML = `<div><span class="eyebrow">${records.length} ${records.length === 1 ? "record" : "records"}</span><h2>${config.label}</h2><p>${config.description}</p></div>`;

	if (config.createFields) {
		const createButton = document.createElement("button");
		createButton.className = "primary-button";
		createButton.innerHTML = `${icon("plus")} Add ${config.singular}`;
		createButton.addEventListener("click", () => openForm(name, "create"));
		intro.append(createButton);
	}

	content.append(intro);

	if (records.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty-state";
		empty.innerHTML = `<div class="empty-icon">${icon(name)}</div><h2>No ${config.label.toLowerCase()} yet</h2><p>Create the first record or refresh after the API changes.</p>`;
		content.append(empty);
		return;
	}

	const wrapper = document.createElement("div");
	wrapper.className = "table-card";
	const table = document.createElement("table");
	const head = document.createElement("thead");
	const headerRow = document.createElement("tr");

	for (const column of config.columns) {
		const th = document.createElement("th");
		th.textContent = column.label;
		headerRow.append(th);
	}

	const actionsHeader = document.createElement("th");
	actionsHeader.textContent = "Actions";
	actionsHeader.className = "actions-column";
	headerRow.append(actionsHeader);
	head.append(headerRow);
	table.append(head);

	const body = document.createElement("tbody");
	for (const record of records) {
		const row = document.createElement("tr");
		for (const column of config.columns) {
			const cell = document.createElement("td");
			cell.textContent = String(column.value(record as never));
			if (column.className) cell.className = column.className;
			row.append(cell);
		}

		const actions = document.createElement("td");
		actions.className = "row-actions";
		if (config.editFields) {
			actions.append(actionButton("Edit", "edit", () => openForm(name, "edit", record)));
		}
		if (config.canChangePassword) {
			actions.append(actionButton("Change password", "key", () => openPasswordForm(record as User)));
		}
		actions.append(actionButton("Delete", "trash", () => deleteRecord(name, record)));
		row.append(actions);
		body.append(row);
	}

	table.append(body);
	wrapper.append(table);
	content.append(wrapper);
}

function actionButton(label: string, iconName: string, callback: () => void) {
	const button = document.createElement("button");
	button.className = `table-action ${iconName === "trash" ? "danger" : ""}`;
	button.title = label;
	button.setAttribute("aria-label", label);
	button.innerHTML = icon(iconName);
	button.addEventListener("click", callback);
	return button;
}

async function openForm(name: ResourceName, mode: "create" | "edit", record?: RecordValue) {
	const config = resources[name];
	const fields = mode === "create" ? config.createFields : config.editFields;
	if (!fields) return;

	const initialValues = mode === "edit" && record && config.toEditValues ? config.toEditValues(record as never) : {};
	form.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">${mode}</span><h2>${mode === "create" ? "Add" : "Edit"} ${config.singular}</h2></div><button type="button" class="dialog-close" aria-label="Close">×</button></div><div class="form-fields"></div><div class="dialog-actions"><button type="button" class="secondary-button cancel-button">Cancel</button><button type="submit" class="primary-button">${mode === "create" ? "Create" : "Save changes"}</button></div>`;

	form.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
	form.querySelector(".cancel-button")?.addEventListener("click", () => dialog.close());

	const fieldsContainer = form.querySelector<HTMLDivElement>(".form-fields");
	if (!fieldsContainer) return;

	for (const field of fields) {
		const label = document.createElement("label");
		label.className = "form-field";
		const labelText = document.createElement("span");
		labelText.textContent = field.label;
		label.append(labelText);

		let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
		if (field.type === "textarea") {
			control = document.createElement("textarea");
			control.rows = 3;
		} else if (field.type === "select") {
			control = document.createElement("select");
			const placeholder = document.createElement("option");
			placeholder.value = "";
			placeholder.textContent = "Select an option";
			control.append(placeholder);
			for (const option of (await field.options?.()) ?? []) {
				const element = document.createElement("option");
				element.value = String(option.value);
				element.textContent = option.label;
				control.append(element);
			}
		} else {
			control = document.createElement("input");
			control.type = field.type ?? "text";
		}

		control.name = field.name;
		control.required = field.required ?? false;
		const initial = initialValues[field.name];
		control.value = initial === null || initial === undefined ? "" : String(initial);
		label.append(control);
		fieldsContainer.append(label);
	}

	form.onsubmit = async (event) => {
		event.preventDefault();
		const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (submit) submit.disabled = true;

		try {
			const payload = readForm(fields);
			if (mode === "create") {
				await post(`/${name}`, payload);
			} else if (record) {
				await patch(`/${name}/${record.id}`, payload);
			}

			dialog.close();
			showToast(
				`${config.singular[0]?.toUpperCase()}${config.singular.slice(1)} ${mode === "create" ? "created" : "updated"}`,
			);
			await loadCurrentView();
		} catch (error) {
			showToast(errorMessage(error), "error");
		} finally {
			if (submit) submit.disabled = false;
		}
	};

	dialog.showModal();
}

function readForm(fields: Field[]) {
	const data = new FormData(form);
	const payload: Record<string, FormValue> = {};

	for (const field of fields) {
		const value = String(data.get(field.name) ?? "");
		if (field.type === "select") {
			payload[field.name] = Number(value);
		} else if (field.nullable && value === "") {
			payload[field.name] = null;
		} else if (value !== "" || field.required) {
			payload[field.name] = value;
		}
	}

	return payload;
}

async function openPasswordForm(user: User) {
	form.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">Security</span><h2>Change password</h2><p class="password-user"></p></div><button type="button" class="dialog-close" aria-label="Close">×</button></div><div class="form-fields"><label class="form-field"><span>New password</span><input name="password" type="password" minlength="8" maxlength="100" required autocomplete="new-password"></label></div><div class="dialog-actions"><button type="button" class="secondary-button cancel-button">Cancel</button><button type="submit" class="primary-button">Update password</button></div>`;
	const passwordUser = form.querySelector<HTMLElement>(".password-user");
	if (passwordUser) passwordUser.textContent = user.email;
	form.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
	form.querySelector(".cancel-button")?.addEventListener("click", () => dialog.close());
	form.onsubmit = async (event) => {
		event.preventDefault();
		const data = new FormData(form);
		try {
			await put(`/users/${user.id}/password`, { password: data.get("password") });
			dialog.close();
			showToast("Password updated");
		} catch (error) {
			showToast(errorMessage(error), "error");
		}
	};
	dialog.showModal();
}

async function deleteRecord(name: ResourceName, record: RecordValue) {
	const config = resources[name];
	if (!window.confirm(`Delete this ${config.singular}? Related records may also be deleted.`)) return;

	try {
		await remove(`/${name}/${record.id}`);
		showToast(`${config.singular[0]?.toUpperCase()}${config.singular.slice(1)} deleted`);
		await loadCurrentView();
	} catch (error) {
		showToast(errorMessage(error), "error");
	}
}

async function loadCurrentView() {
	const sequence = ++loadSequence;
	setLoading();

	try {
		if (activeView === "overview") {
			await loadOverview(sequence);
		} else {
			await loadResource(activeView, sequence);
		}
	} catch (error) {
		if (sequence === loadSequence) renderFailure(error);
	}
}

function navigate(view: "overview" | ResourceName) {
	activeView = view;
	title.textContent = view === "overview" ? "Overview" : resources[view].label;
	document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((button) => {
		button.classList.toggle("active", button.dataset.view === view);
	});
	void loadCurrentView();
}

document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((button) => {
	button.addEventListener("click", () => navigate(button.dataset.view as "overview" | ResourceName));
});

document.querySelector("#refresh-button")?.addEventListener("click", () => void loadCurrentView());
dialog.addEventListener("click", (event) => {
	if (event.target === dialog) dialog.close();
});

void loadCurrentView();
