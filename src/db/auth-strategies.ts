import type { AzureSsoConfig, Prisma } from "../generated/prisma/client.js";
import { AuthenticationStrategy } from "../generated/prisma/enums.js";
import type { AzureConfigInput } from "../server/auth-strategy-schemas.js";
import { DatabaseRecordNotFoundError, DatabaseRelationError } from "./errors.js";
import prisma from "./prisma.js";

export const strategyCodes = Object.values(AuthenticationStrategy);
export function isAzureStrategy(strategy: AuthenticationStrategy) {
	return strategy === "AZURE_SSO_SERVER" || strategy === "AZURE_SSO_CLIENT";
}

export function safeAzureConfig(config: AzureSsoConfig) {
	const { clientSecret, ...safe } = config;
	return { ...safe, hasClientSecret: Boolean(clientSecret) };
}

export async function isStrategyEnabledForTenantApplication(
	tenantApplicationId: number,
	strategy: AuthenticationStrategy,
) {
	const record = await prisma.tenantApplicationAuthenticationStrategy.findUnique({
		where: { tenantApplicationId_strategy: { tenantApplicationId, strategy } },
		select: { enabled: true },
	});
	return record?.enabled === true;
}

export async function listStrategies(tenantApplicationId: number) {
	const app = await prisma.tenantApplication.findUnique({ where: { id: tenantApplicationId } });
	if (!app) throw new DatabaseRecordNotFoundError("Tenant application");
	const records = await prisma.tenantApplicationAuthenticationStrategy.findMany({
		where: { tenantApplicationId },
		include: { azureSsoConfig: true },
		orderBy: { strategy: "asc" },
	});
	return records.map(({ azureSsoConfig, ...record }) => ({
		...record,
		azureSsoConfig: azureSsoConfig ? safeAzureConfig(azureSsoConfig) : null,
	}));
}

async function writeConfig(
	tx: Prisma.TransactionClient,
	strategyId: number,
	strategy: AuthenticationStrategy,
	input: AzureConfigInput,
	createOnly = false,
) {
	if (!isAzureStrategy(strategy))
		throw new DatabaseRelationError("Only Azure strategies can have an Azure configuration");
	const current = await tx.azureSsoConfig.findUnique({ where: { tenantApplicationStrategyId: strategyId } });
	if (createOnly && current)
		throw new DatabaseRelationError("This strategy already has an Azure configuration; edit it instead");
	const clientSecret =
		input.clientSecret === undefined
			? (current?.clientSecret ?? null)
			: input.clientSecret === null
				? null
				: input.clientSecret;
	if (strategy === "AZURE_SSO_SERVER" && !clientSecret) {
		throw new DatabaseRelationError("Azure server login requires a client secret");
	}
	const data = {
		name: input.name,
		description: input.description ?? null,
		directoryTenantId: input.directoryTenantId,
		clientId: input.clientId,
		redirectUri: input.redirectUri,
		scopes: input.scopes,
		clientSecret,
	};
	return tx.azureSsoConfig.upsert({
		where: { tenantApplicationStrategyId: strategyId },
		create: { ...data, tenantApplicationStrategyId: strategyId },
		update: data,
	});
}

export async function saveStrategy(
	tenantApplicationId: number,
	strategy: AuthenticationStrategy,
	enabled: boolean,
	config?: AzureConfigInput,
	createOnly = false,
) {
	return prisma.$transaction(async (tx) => {
		const record = await tx.tenantApplicationAuthenticationStrategy.upsert({
			where: { tenantApplicationId_strategy: { tenantApplicationId, strategy } },
			create: { tenantApplicationId, strategy, enabled: false },
			update: {},
		});
		if (config) await writeConfig(tx, record.id, strategy, config, createOnly);
		if (enabled && isAzureStrategy(strategy)) {
			const existing = await tx.azureSsoConfig.findUnique({ where: { tenantApplicationStrategyId: record.id } });
			if (!existing) throw new DatabaseRelationError("Add an Azure configuration before enabling this strategy");
			if (strategy === "AZURE_SSO_SERVER" && !existing.clientSecret) {
				throw new DatabaseRelationError("Azure server login requires a client secret");
			}
		}
		const saved = await tx.tenantApplicationAuthenticationStrategy.update({
			where: { id: record.id },
			data: { enabled },
			include: { azureSsoConfig: true },
		});
		return { ...saved, azureSsoConfig: saved.azureSsoConfig ? safeAzureConfig(saved.azureSsoConfig) : null };
	});
}

const configDetails = {
	tenantApplicationStrategy: {
		include: {
			tenantApplication: { include: { tenant: { select: { name: true } }, application: { select: { name: true } } } },
		},
	},
} as const;
export async function listAzureConfigs() {
	return (await prisma.azureSsoConfig.findMany({ include: configDetails, orderBy: { name: "asc" } })).map((config) => ({
		...safeAzureConfig(config),
		tenantApplicationStrategy: config.tenantApplicationStrategy,
	}));
}
export async function findAzureConfig(id: number) {
	const config = await prisma.azureSsoConfig.findUnique({ where: { id }, include: configDetails });
	if (!config) throw new DatabaseRecordNotFoundError("Azure configuration");
	return { ...safeAzureConfig(config), tenantApplicationStrategy: config.tenantApplicationStrategy };
}
export async function updateAzureConfig(id: number, input: AzureConfigInput) {
	return prisma.$transaction(async (tx) => {
		const current = await tx.azureSsoConfig.findUnique({ where: { id }, include: { tenantApplicationStrategy: true } });
		if (!current) throw new DatabaseRecordNotFoundError("Azure configuration");
		return safeAzureConfig(
			await writeConfig(tx, current.tenantApplicationStrategyId, current.tenantApplicationStrategy.strategy, input),
		);
	});
}
export async function deleteAzureConfig(id: number) {
	return prisma.$transaction(async (tx) => {
		const config = await tx.azureSsoConfig.findUnique({ where: { id } });
		if (!config) throw new DatabaseRecordNotFoundError("Azure configuration");
		await tx.tenantApplicationAuthenticationStrategy.update({
			where: { id: config.tenantApplicationStrategyId },
			data: { enabled: false },
		});
		await tx.azureSsoConfig.delete({ where: { id } });
	});
}
