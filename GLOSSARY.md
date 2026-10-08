# Authentication

This context describes users and their relationships to tenant applications for authentication.

## Language

**Tenant**:
A customer group served by the company whose users and tenant applications share the same identity boundary.
_Avoid_: Client (when referring to a customer tenant)

**Application**:
An application that can be associated with multiple tenants.

**Tenant Application**:
An application associated with one tenant, which that tenant's users can join through memberships.

**User**:
An identity belonging to one tenant that can have memberships in that tenant's applications.

**Membership**:
The association between a tenant's user and a tenant application belonging to that same tenant.
_Avoid_: TenantApplicationUser

**Session**:
A time-limited sign-in for one membership.

**Authentication Strategy**:
A method of verifying a user when signing in to a tenant application.

**Enabled Authentication Strategy**:
An authentication strategy available for sign-in to a particular tenant application.

**Session Strategy**:
The mode selected for a tenant application that determines how subsequent requests prove an established sign-in.
