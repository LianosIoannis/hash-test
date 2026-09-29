import * as v from "valibot";
import { AuthenticationStrategy } from "../generated/prisma/enums.js";

const text = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2048));
const guid = v.pipe(v.string(), v.trim(), v.uuid());
const redirect = v.pipe(
	text,
	v.url(),
	v.check((value) => {
		const url = new URL(value);
		return (
			!url.username &&
			!url.password &&
			!url.hash &&
			(url.protocol === "https:" ||
				(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
		);
	}, "Use HTTPS, or HTTP on localhost, without credentials or fragments"),
);

export const strategySchema = v.enum(AuthenticationStrategy);
export const azureConfigSchema = v.strictObject({
	name: v.pipe(text, v.maxLength(100)),
	description: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(2000)))),
	directoryTenantId: guid,
	clientId: guid,
	// Omitted: preserve existing. Null: remove. String: replace.
	clientSecret: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(4096)))),
	redirectUri: redirect,
	scopes: v.pipe(
		text,
		v.check((value) => value.split(/\s+/).includes("openid"), "Scopes must include openid"),
	),
});
export const saveStrategySchema = v.strictObject({
	enabled: v.boolean(),
	azureSsoConfig: v.optional(azureConfigSchema),
});
export const createAzureConfigSchema = v.strictObject({
	...azureConfigSchema.entries,
	tenantApplicationId: v.pipe(v.number(), v.integer(), v.minValue(1)),
	strategy: v.picklist(["AZURE_SSO_SERVER", "AZURE_SSO_CLIENT"]),
	enabled: v.optional(v.boolean(), false),
});
export type AzureConfigInput = v.InferOutput<typeof azureConfigSchema>;
