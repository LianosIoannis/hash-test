export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
		public readonly issues: Array<{ message: string; path: string | null }> = [],
	) {
		super(message);
		this.name = "ApiError";
	}
}

type ErrorResponse = {
	error?: {
		code?: string;
		message?: string;
		issues?: Array<{ message: string; path: string | null }>;
	};
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`/api${path}`, {
		...init,
		headers: {
			...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
			...init?.headers,
		},
	});

	if (response.status === 204) {
		return undefined as T;
	}

	const payload = (await response.json()) as T & ErrorResponse;

	if (!response.ok) {
		throw new ApiError(
			response.status,
			payload.error?.code ?? "REQUEST_FAILED",
			payload.error?.message ?? `Request failed with status ${response.status}`,
			payload.error?.issues,
		);
	}

	return payload;
}

export function get<T>(path: string) {
	return apiRequest<T>(path);
}

export function post<T>(path: string, body: unknown) {
	return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patch<T>(path: string, body: unknown) {
	return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function put<T>(path: string, body: unknown) {
	return apiRequest<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function remove(path: string) {
	return apiRequest<void>(path, { method: "DELETE" });
}
