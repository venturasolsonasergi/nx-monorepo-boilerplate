# Proposal

## Why

The users service can create a profile for the authenticated identity (`POST /users`) but cannot read it back. Once the browser client offers login, the logged-in user needs to retrieve their own profile to display it instead of always seeing the creation form, and a client that already owns a profile currently dead-ends at `409`. There is also no repository lookup by identity: the only read method is `findById`, which is not reachable from the identity. This change adds a session-scoped read.

## What Changes

- Add `GET /users/me` to the users service. It derives the caller's identity exclusively from the validated session cookie and returns the caller's profile.
- Success returns `200` with the existing `ProfileResponse` shape (`id`, `authUserId`, `name`, `surname`, `address`, `phone`).
- A request without a valid session returns `401`.
- A valid session whose identity has no profile returns `404`.
- Reading does not require an additional email-verification check; profile creation keeps its current `403` behavior for unverified identities.
- Add a repository port method `findByAuthUserId` that returns the profile entity or `null`.
- Add a read use case that loads the profile by the session-derived identity and signals a missing profile with a `ProfileNotFoundError`, which the controller maps to `404`.
- Extend `libs/users/specs/openapi.yaml` with the new path, response, and a not-found error schema; bump its version.
- Add contract tests for the HTTP behavior and an e2e test with real sessions proving user isolation.

Non-goals (explicitly out of scope):

- No changes to the `web` namespace; the browser client does not consume this endpoint in this change.
- No changes to the auth service contract, `POST /auth/refresh`, or session behavior.
- No email or other identity fields in the profile response; identity data stays owned by auth.
- No data-model migration; the unique `auth_user_id` column already supports the lookup.
- No change to `POST /users` or the `users/user-registration` capability.

## Capabilities

### New Capabilities

- `users/profile-retrieval`: reading the authenticated caller's own profile from the users service, scoped to the session-derived identity.

### Modified Capabilities

(none)

## Impact

- Affected namespace: `users` (NestJS microservice under `libs/users`, served through the `apps/api` host).
- Code: `libs/users/infrastructure/users.controller.ts`, `libs/users/application/profile.repository.ts`, a new read use case under `libs/users/application`, `libs/users/infrastructure/users.repository.prisma.ts`, and `libs/users/infrastructure/users.module.ts` wiring.
- Contract: `libs/users/specs/openapi.yaml` gains `GET /users/me` and a `NotFoundError` schema.
- Tests: `libs/users/tests/users.contract.spec.ts` (HTTP mapping) and `apps/api-e2e/test/auth-users.e2e-spec.ts` (real-session isolation).
- No database migration, no new dependency, and no change to the auth service or the web client.
