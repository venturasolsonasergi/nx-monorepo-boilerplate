# Tasks

## 1. OpenAPI contract first (namespace: users)

- [x] 1.1 Extend `libs/users/specs/openapi.yaml` with `GET /users/me` (session cookie security, `200` referencing `ProfileResponse`, `401`, `404`), add a `NotFoundError` component matching the intended controller body, and bump the document version.
- [x] 1.2 Review the updated contract against the agreed behavior (200 with the existing `ProfileResponse`, 401 without a valid session, 404 without a profile, no email-verification gate, no client-supplied identifier) and verify it before any code: run `pnpm run validate:openapi -- --service users` and `openspec validate add-current-user-profile-retrieval` and confirm both pass.

## 2. Repository lookup by identity (namespace: users)

- [x] 2.1 Add `findByAuthUserId(authUserId: string): Promise<ProfileEntity | null>` to the `ProfileRepository` port in `libs/users/application/profile.repository.ts`, and verify `pnpm validate:architecture` and `pnpm check:dependencies` still pass (application layer stays free of Prisma).
- [x] 2.2 Implement `findByAuthUserId` in `UsersPrismaRepository` in `libs/users/infrastructure/users.repository.prisma.ts` using the unique `auth_user_id` column and reusing the existing `toProfileEntity` mapping, and verify the users contract suite still passes with `pnpm api:test -- libs/users/tests/users.contract.spec.ts`.

## 3. Read use case (namespace: users)

- [x] 3.1 Add a `ProfileNotFoundError` in `libs/users/application/profile.repository.ts` (or a sibling application file) alongside the existing `ProfileAlreadyExistsError`.
- [x] 3.2 Add a `GetCurrentProfileUseCase` in `libs/users/application/` that loads the profile via `findByAuthUserId` and throws `ProfileNotFoundError` when it returns `null`. The use case MUST return a flat output object with the six public fields and a mandatory `id` (mirror `CreateProfileOutput` in `create-profile.use-case.ts:14`, `ProfileEntity['props'] & { id: number }`), never the raw `ProfileEntity` (whose fields live under `props`); throw when the loaded profile has no `id`. Verify with a unit spec that asserts the flat output shape (no `props` wrapper) and both outcomes: `pnpm api:test -- libs/users/tests/get-current-profile.use-case.spec.ts`.

## 4. Controller and module wiring (namespace: users)

- [x] 4.1 Add a `GET /users/me` handler to `libs/users/infrastructure/users.controller.ts` that returns `401` when `request.authUserId` is absent, calls the read use case with only the session identity and no client-supplied identifier, maps `ProfileNotFoundError` to `404`, and returns the flat profile output otherwise without checking `request.authEmailVerified`; wire the use case in `libs/users/infrastructure/users.module.ts` with the same factory pattern as `CreateProfileUseCase`.
- [x] 4.2 Extend `libs/users/tests/users.contract.spec.ts` with the read use case provider and cases for `200` (flat profile returned), `401` (no session), `404` (use case throws `ProfileNotFoundError`), no `403` when `x-email-verified` is `false`, and that the use case receives exclusively the session identity even when the request supplies a different identifier (query parameter or body); verify with `pnpm api:test -- libs/users/tests/users.contract.spec.ts`.

## 5. End-to-end isolation (namespaces: users, via apps/api host)

- [x] 5.1 Add an e2e case to `apps/api-e2e/test/auth-users.e2e-spec.ts` where identity A creates a profile and retrieves it with `GET /users/me` (`200`, A's own data); identity B with a valid session and no profile receives `404` for `/users/me`; B also receives `404` (never A's data) when it supplies a manipulated identifier such as `/users/me?authUserId=<A>`; and a request without a session receives `401`; verify with `pnpm api:test:e2e`.

## 6. Repo-wide verification

- [x] 6.1 Run `pnpm validate:architecture`, `pnpm check:dependencies`, `pnpm run verify`, and `pnpm lint` and confirm all pass.
- [x] 6.2 Run `openspec validate add-current-user-profile-retrieval` and confirm the change validates.
