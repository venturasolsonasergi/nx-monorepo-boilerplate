# Design

## Context

See `proposal.md` - Why. Current constraints that shape the approach:

- The users service exposes only `POST /users` (create) and `GET /users/health`. Profiles are stored in `user_profiles` with a unique `auth_user_id`; only `findById` is available in the repository port, and it cannot be reached from the session identity.
- `SessionValidationMiddleware` already runs for every `users` route except `users/health` and populates `request.authUserId` and `request.authEmailVerified`. `POST /users` reads those to enforce session and email verification.
- `OriginValidationMiddleware` only validates unsafe methods, so a `GET` needs no trusted `Origin`.
- `libs/users/specs/openapi.yaml` (version `0.3.0`, `x-spec-id: create-profile`) is the authoritative HTTP contract.
- Layering is enforced: domain is free of NestJS/Prisma/Zod, application must not import Prisma, and controllers stay thin with repository ports in application.

## Goals / Non-Goals

**Goals:**

- Add a session-scoped read of the caller's own profile using the existing identity plumbing.
- Add the missing repository lookup by identity without a data-model migration.
- Keep the HTTP response aligned with the existing `ProfileResponse` and extend the OpenAPI contract.
- Prove HTTP mapping in contract tests and identity isolation with a real-session e2e test.

**Non-Goals:**

- No `web` consumption, login UI, or browser behavior in this change.
- No identity data (email) in the response; that stays owned by the auth namespace.
- No change to `POST /users`, the auth contract, or the session/refresh behavior.
- No schema migration, new dependency, or removal of the existing unused `findById`.

## Decisions

- **Endpoint `GET /users/me`, identity strictly from the session.** The path is scoped under the existing `/users` collection and takes no identifier parameter. Alternatives: `GET /users/:id` (rejected - exposes identity enumeration and needs its own authorization); `GET /auth/me` (rejected - profile data belongs to the users namespace, not identity).
- **Missing profile returns `404` via a `ProfileNotFoundError`.** The use case signals absence with an application error mapped to `404` by the controller, symmetric with the existing `ProfileAlreadyExistsError` -> `409` mapping. Alternative: use case returns `null` and the controller maps it (rejected for weaker symmetry with the create flow); `200` with a null body (rejected - ambiguous for clients).
- **Session-only authorization, no email-verification gate.** Reading the caller's own linked data is not a mutation, and an identity can only own a profile it was allowed to create. The controller checks `request.authUserId` (401 when absent) but not `request.authEmailVerified`. Alternative: mirror the create 403 (rejected as an unnecessary gate on a read).
- **Repository port gains `findByAuthUserId` returning `ProfileEntity | null`.** Implemented in the Prisma adapter against the existing unique `auth_user_id` index. Layer placement: port and use case in `application`; adapter and controller in `infrastructure`; domain untouched.
- **Read use case returns a flat public object, not the entity.** The output mirrors `CreateProfileOutput` (`ProfileEntity['props'] & { id: number }`), so the six public fields are top-level and `id` is mandatory. Returning `ProfileEntity` directly would expose a `{ props: ... }` wrapper incompatible with `ProfileResponse`.
- **Contract first, then implementation.** The OpenAPI path is updated and validated (`pnpm run validate:openapi -- --service users`) before repository, use case, and controller work, matching the project's OpenAPI-driven workflow.
- **Reuse `ProfileResponse`; add a `NotFoundError` component.** The OpenAPI response for the new path references `ProfileResponse` unchanged, and the version is bumped. No auth contract change.
- **Testing split.** The contract test mocks the read use case to assert 200/401/404 mapping and that the use case receives only the session identity even when the request supplies a different identifier; the e2e test with two real sessions asserts that the profile is filtered by `authUserId` at the database level, including a manipulated `?authUserId=<A>` request.

## Risks / Trade-offs

- [Session-derived identity wiring assumed correct] -> Cover it with both a contract test (controller reads `authUserId` from the request) and the e2e test (A gets its profile, B gets 404).
- [E2E leaves rows behind] -> Reuse the existing `testEmails` cleanup in `auth-users.e2e-spec.ts`, which already deletes created profiles.
- [`x-spec-id: create-profile` no longer describes the full document] -> No functional impact; it only feeds future branch-naming tooling. Tracked as an open question.
- [Duplicate read surface] -> The capability is deliberately separate from `users/user-registration` so creation behavior stays untouched; no near-duplicate spec is introduced.

## Migration Plan

Additive and backward compatible: a new route, a new repository method, and new OpenAPI path. No database migration and no coordinated deploy. Rollback is removing the route and its OpenAPI path; no data is affected.

## Open Questions

- Whether `x-spec-id` in `libs/users/specs/openapi.yaml` should be generalized now that the document covers more than profile creation. Deferrable; it affects only future tooling, not this change.
