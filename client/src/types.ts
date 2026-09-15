export type Overview = {
	tenants: number;
	applications: number;
	tenantApplications: number;
	users: number;
	memberships: number;
	activeSessions: number;
	expiredSessions: number;
};

export type Tenant = {
	id: number;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	_count?: { tenantApplications: number; users: number };
};

export type Application = {
	id: number;
	code: string;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	_count?: { tenantApplications: number };
};

export type TenantApplication = {
	id: number;
	key: string;
	tenantId: number;
	applicationId: number;
	createdAt: string;
	updatedAt: string;
	tenant?: { id: number; name: string };
	application?: { id: number; code: string; name: string };
	_count?: { users: number };
};

export type User = {
	id: number;
	email: string;
	username: string;
	tenantId: number;
	createdAt: string;
	updatedAt: string;
	tenant?: { id: number; name: string };
	_count?: { applications: number };
};

export type Membership = {
	id: number;
	userId: number;
	tenantApplicationId: number;
	createdAt: string;
	updatedAt: string;
	user?: { id: number; email: string; username: string; tenantId: number };
	tenantApplication?: TenantApplication;
	_count?: { sessions: number };
};

export type Session = {
	id: number;
	tenantApplicationUserId: number;
	createdAt: string;
	expiresAt: string;
	tenantApplicationUser?: {
		user: { id: number; email: string; username: string };
		tenantApplication: {
			id: number;
			key: string;
			application: { id: number; code: string; name: string };
		};
	};
};
