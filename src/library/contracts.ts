export interface AuthIdentity {
	userId: number;
	tenantId: number;
	tenantApplicationId: number;
	membershipId: number;
	sessionId: number;
}

export interface JwtSession {
	mode: "JWT";
	jwt_token: string;
	expiresAt: string;
}
