# Proposal

## Why

The users service currently owns both profile data and email-based user registration. A dedicated, self-hosted authentication service is needed to make identity and sessions authoritative in one place while users owns business profiles only.

## What Changes

- Add an auth service backed by Better Auth with isolated identity persistence, email/password registration and login, email verification, password reset, OAuth, session renewal, and logout.
- Authenticate browser requests with a secure, HTTP-only session cookie; provide a reusable session-validation boundary that supplies the authenticated identity to protected services.
- **BREAKING** Replace `POST /users` registration with authenticated profile creation for the caller's verified identity. Remove email and other identity fields from users profile persistence and responses; reject duplicate profiles for one identity.
- Registration returns an identity in a pending-verification state without an active session; login is unavailable until email verification succeeds. The web client logs in and then creates its profile explicitly.
- Document both HTTP contracts and the signup, verification, login, profile, OAuth, renewal, and password-reset flows before implementation.
- Non-goals: changing orders endpoints or adding external/mobile bearer-token integrations, automatic profile creation on signup, or transferring existing production data without a separate migration plan.

## Capabilities

### New Capabilities

- `auth/identity-sessions`: Identity registration, verification, credentials, OAuth, and browser session lifecycle owned by auth.

### Modified Capabilities

- `users/user-registration`: Replace email-based registration with creation of a profile linked to the authenticated and email-verified identity.

## Impact

- New `libs/auth` service, its OpenAPI contract, Prisma schema/config/client and independent migrations, contract tests, and Better Auth dependency; the API host must mount the service and share its session-validation adapter with users.
- Update `libs/users` contract, use case, domain, Prisma schema/migration, and tests to remove identity ownership and use an `authUserId` profile reference; preserve the users health endpoint.
- Configure auth database and secrets/email/OAuth settings in the runtime deployment. Independent service databases mean the `authUserId` relationship is validated at the API boundary, not enforced as a cross-database foreign key.
- Existing clients of `POST /users` and existing users rows require an explicit migration or coordinated cutover; the old request and response contract will no longer be valid.