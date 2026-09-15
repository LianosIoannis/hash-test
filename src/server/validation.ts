import * as v from "valibot";
import { ApiError } from "./errors.js";

const idSchema = v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number), v.integer(), v.minValue(1));

export function parseId(value: string | undefined, name = "id") {
	if (value === undefined) {
		throw new ApiError(400, "INVALID_ID", `${name} is required`);
	}

	try {
		return v.parse(idSchema, value);
	} catch {
		throw new ApiError(400, "INVALID_ID", `${name} must be a positive integer`);
	}
}

export function requireRecord<T>(record: T | null, name: string): T {
	if (record === null) {
		throw new ApiError(404, "NOT_FOUND", `${name} not found`);
	}

	return record;
}
