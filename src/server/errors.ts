import type { ErrorRequestHandler } from "express";
import * as v from "valibot";
import { DatabaseRecordNotFoundError, DatabaseRelationError } from "../db/errors.js";

export class ApiError extends Error {
	constructor(
		public readonly statusCode: number,
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

type PrismaError = Error & {
	code?: string;
	meta?: unknown;
};

type HttpError = Error & {
	type?: string;
};

function isPrismaError(error: unknown): error is PrismaError {
	return error instanceof Error && "code" in error && typeof error.code === "string" && error.code.startsWith("P");
}

function isInvalidJsonError(error: unknown): error is HttpError {
	if (!(error instanceof Error)) {
		return false;
	}

	const httpError = error as HttpError;
	return httpError.type === "entity.parse.failed";
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
	if (error instanceof ApiError) {
		response.status(error.statusCode).json({
			error: {
				code: error.code,
				message: error.message,
			},
		});
		return;
	}

	if (error instanceof v.ValiError) {
		response.status(400).json({
			error: {
				code: "VALIDATION_ERROR",
				message: "The request contains invalid data",
				issues: error.issues.map((issue) => ({
					message: issue.message,
					path: issue.path?.map((item: { key: unknown }) => String(item.key)).join(".") ?? null,
				})),
			},
		});
		return;
	}

	if (error instanceof DatabaseRecordNotFoundError) {
		response.status(404).json({
			error: {
				code: "NOT_FOUND",
				message: error.message,
			},
		});
		return;
	}

	if (error instanceof DatabaseRelationError) {
		response.status(400).json({
			error: {
				code: "INVALID_RELATION",
				message: error.message,
			},
		});
		return;
	}

	if (isInvalidJsonError(error)) {
		response.status(400).json({
			error: {
				code: "INVALID_JSON",
				message: "The request body is not valid JSON",
			},
		});
		return;
	}

	if (isPrismaError(error)) {
		if (error.code === "P2002") {
			response.status(409).json({
				error: {
					code: "CONFLICT",
					message: "A record with those unique values already exists",
				},
			});
			return;
		}

		if (error.code === "P2025") {
			response.status(404).json({
				error: {
					code: "NOT_FOUND",
					message: "The requested record was not found",
				},
			});
			return;
		}

		if (error.code === "P2003") {
			response.status(409).json({
				error: {
					code: "RELATION_CONFLICT",
					message: "The operation conflicts with a related record",
				},
			});
			return;
		}
	}

	console.error(error);
	response.status(500).json({
		error: {
			code: "INTERNAL_ERROR",
			message: "An unexpected error occurred",
		},
	});
};
