export type AzureConfig = {
	id: number;
	name: string;
	description: string | null;
	tenantApplicationStrategyId: number;
	directoryTenantId: string;
	clientId: string;
	redirectUri: string;
	scopes: string;
	hasClientSecret: boolean;
	tenantApplicationStrategy?: {
		id: number;
		strategy: string;
		enabled: boolean;
		tenantApplicationId: number;
		tenantApplication: { tenant: { name: string }; application: { name: string } };
	};
};

export type AppStrategy = {
	id: number;
	strategy: string;
	enabled: boolean;
	azureSsoConfig: AzureConfig | null;
};
