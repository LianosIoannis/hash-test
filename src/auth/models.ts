import * as v from "valibot";

export const authenticateWithEmailSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
	tenantId: v.pipe(v.number(), v.minValue(1)),
});

export const authenticateWithUsernameSchema = v.object({
	username: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
	tenantId: v.pipe(v.number(), v.minValue(1)),
});

export const signUpSchema = v.pipe(
	v.object({
		email: v.pipe(v.string(), v.email()),

		username: v.optional(v.string()),

		password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),

		tenantId: v.number(),
	}),
	v.transform((input) => ({ ...input, username: input.username?.trim() || input.email })),
);

export const signInWithEmailSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
	tenantApplicationKey: v.pipe(v.string(), v.minLength(2)),
});

export const signInWithUsernameSchema = v.object({
	username: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
	tenantApplicationKey: v.pipe(v.string(), v.minLength(2)),
});

export type SignInWithEmailInput = v.InferInput<typeof signInWithEmailSchema>;

export type SignInWithUsernameInput = v.InferInput<typeof signInWithUsernameSchema>;

export type SignUpInput = v.InferInput<typeof signUpSchema>;

export type AuthenticateWithEmailInput = v.InferInput<typeof authenticateWithEmailSchema>;

export type AuthenticateWithUsernameInput = v.InferInput<typeof authenticateWithUsernameSchema>;
