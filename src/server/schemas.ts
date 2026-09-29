import * as v from "valibot";

const requiredText = v.pipe(
	v.string(),
	v.transform((value) => value.trim()),
	v.minLength(1),
);
const optionalDescription = v.optional(
	v.nullable(
		v.pipe(
			v.string(),
			v.transform((value) => value.trim()),
		),
	),
);
const positiveId = v.pipe(v.number(), v.integer(), v.minValue(1));
const normalizedEmail = v.pipe(
	v.string(),
	v.transform((value) => value.trim().toLowerCase()),
	v.email(),
);
const phoneNumber = v.nullable(
	v.pipe(v.string(), v.trim(), v.regex(/^\+[1-9]\d{1,14}$/, "Use an international phone number such as +306912345678")),
);

export const createTenantSchema = v.object({
	name: requiredText,
	description: optionalDescription,
});

export const updateTenantSchema = v.pipe(
	v.partial(createTenantSchema),
	v.check((input) => Object.values(input).some((value) => value !== undefined), "At least one field is required"),
);

export const createApplicationSchema = v.object({
	code: requiredText,
	name: requiredText,
	description: optionalDescription,
});

export const updateApplicationSchema = v.pipe(
	v.partial(createApplicationSchema),
	v.check((input) => Object.values(input).some((value) => value !== undefined), "At least one field is required"),
);

export const createTenantApplicationSchema = v.object({
	tenantId: positiveId,
	applicationId: positiveId,
	key: requiredText,
});

export const updateTenantApplicationSchema = v.object({
	key: requiredText,
});

export const createUserSchema = v.pipe(
	v.object({
		tenantId: positiveId,
		email: normalizedEmail,
		username: v.optional(
			v.pipe(
				v.string(),
				v.transform((value) => value.trim()),
			),
		),
		password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
		phoneNumber: v.optional(phoneNumber),
		emailVerified: v.optional(v.boolean(), false),
		phoneVerified: v.optional(v.boolean(), false),
	}),
	v.transform((input) => ({
		...input,
		username: input.username || input.email,
	})),
);

export const updateUserSchema = v.pipe(
	v.object({
		email: v.optional(normalizedEmail),
		username: v.optional(requiredText),
		phoneNumber: v.optional(phoneNumber),
		emailVerified: v.optional(v.boolean()),
		phoneVerified: v.optional(v.boolean()),
	}),
	v.check((input) => Object.values(input).some((value) => value !== undefined), "At least one field is required"),
);

export const updatePasswordSchema = v.object({
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
});

export const createMembershipSchema = v.object({
	userId: positiveId,
	tenantApplicationId: positiveId,
});
