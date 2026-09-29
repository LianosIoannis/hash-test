import { Router } from "express";
import * as v from "valibot";
import {
	deleteAzureConfig,
	findAzureConfig,
	listAzureConfigs,
	listStrategies,
	saveStrategy,
	strategyCodes,
	updateAzureConfig,
} from "../../db/auth-strategies.js";
import {
	azureConfigSchema,
	createAzureConfigSchema,
	saveStrategySchema,
	strategySchema,
} from "../auth-strategy-schemas.js";
import { parseId } from "../validation.js";

export const authStrategiesRouter = Router();
authStrategiesRouter.get("/", (_request, response) => {
	response.json(strategyCodes);
});

export const applicationStrategiesRouter = Router({ mergeParams: true });
applicationStrategiesRouter.get<{ id: string }>("/", async (request, response) => {
	response.json(await listStrategies(parseId(request.params.id)));
});
applicationStrategiesRouter.put<{ id: string; strategy: string }>("/:strategy", async (request, response) => {
	const input = v.parse(saveStrategySchema, request.body);
	response.json(
		await saveStrategy(
			parseId(request.params.id),
			v.parse(strategySchema, request.params.strategy),
			input.enabled,
			input.azureSsoConfig,
		),
	);
});

export const azureConfigsRouter = Router();
azureConfigsRouter.get("/", async (_request, response) => {
	response.json(await listAzureConfigs());
});
azureConfigsRouter.get("/:id", async (request, response) => {
	response.json(await findAzureConfig(parseId(request.params.id)));
});
azureConfigsRouter.post("/", async (request, response) => {
	const { tenantApplicationId, strategy, enabled, ...config } = v.parse(createAzureConfigSchema, request.body);
	const saved = await saveStrategy(tenantApplicationId, strategy, enabled, config, true);
	response.status(201).json(saved.azureSsoConfig);
});
azureConfigsRouter.patch("/:id", async (request, response) => {
	response.json(await updateAzureConfig(parseId(request.params.id), v.parse(azureConfigSchema, request.body)));
});
azureConfigsRouter.delete("/:id", async (request, response) => {
	await deleteAzureConfig(parseId(request.params.id));
	response.status(204).send();
});
