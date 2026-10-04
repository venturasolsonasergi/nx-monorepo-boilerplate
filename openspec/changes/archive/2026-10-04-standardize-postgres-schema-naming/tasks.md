# Tasks

## 1. Auth schema naming migration (namespace: auth)

- [x] 1.1 Update `libs/auth/infrastructure/prisma/schema.prisma` with `@map`/`@@map` and explicit `map:` names for PK, unique, index, and FK objects per design decision 2, keeping Prisma model and field names camelCase (the documented Better Auth adapter exception); verify `pnpm prisma:generate -- --service auth` succeeds and the generated client still exposes `user`, `session`, `account`, `verification` with camelCase fields.
- [x] 1.2 Author a hand-written forward migration at `libs/auth/infrastructure/prisma/migrations/<timestamp>_snake_case_naming/migration.sql` using `ALTER TABLE ... RENAME COLUMN`, `ALTER TABLE ... RENAME CONSTRAINT`, and `ALTER INDEX ... RENAME TO` (never drop/add); verify it applies against a disposable auth database and that `prisma migrate status` and `prisma migrate diff` report no drift.
- [x] 1.3 Verify data preservation for auth: capture row counts and sampled `auth_users.id` values before and after the migration and confirm they are identical, then assert the final physical column, constraint, and index names with a `pg_catalog`/`information_schema` query that returns only lowercase snake_case identifiers and confirms `auth_users.id` remains `text`.
- [x] 1.4 Run the auth contract tests and the real signup -> verify-email -> login -> refresh -> logout flow against the migrated schema; verify `pnpm run verify -- --service auth` and `pnpm run validate:openapi -- --service auth` pass, the `POST /auth/signup` response still exposes the same public `userId` field name and type, and an existing session still resolves its userId.

## 2. Auth identifier format for new identities (namespace: auth)

- [x] 2.1 Configure `advanced.database.generateId` in `libs/auth/infrastructure/better-auth.adapter.ts` to a function returning `crypto.randomUUID()`, without adding any `@default` to the `id` fields and without altering existing rows; verify `pnpm prisma:generate -- --service auth` and the auth build/typecheck succeed.
- [x] 2.2 Add an auth test asserting that a newly registered identity's `userId` matches canonical UUID format while a previously issued non-UUID id still resolves unchanged, and that a new session/account/verification id is also UUID-formatted; verify the auth contract test suite passes and the `New identity follows the documented identifier strategy` and `Legacy and new identifiers coexist` scenarios are covered.
- [x] 2.3 Query the disposable database to confirm `auth_users.id`, `auth_sessions.id`, `auth_accounts.id`, and `auth_verification_tokens.id` remain `text` after new signups, and confirm no pre-existing id value changed.
- [x] 2.4 Add an end-to-end test proving a pre-existing session with a legacy non-UUID identity id still authenticates a protected route (`POST /users`, reporting the legacy `authUserId`) and can be refreshed (`POST /auth/refresh`, same legacy userId); verify the full e2e suite passes.

## 3. Users schema naming and persistence casing (namespace: users)

- [x] 3.1 Update `libs/users/infrastructure/prisma/schema.prisma` with `@@map("user_profiles")`, rename the Prisma field `authUserId` to `auth_user_id` (snake_case, no `@map` needed since field and column match), and set explicit `map:` names for the PK constraint and unique index, keeping the Prisma model name `UserRecord` and the `Int` autoincrement primary key; verify `pnpm prisma:generate -- --service users` succeeds.
- [x] 3.2 Update `libs/users/infrastructure/users.repository.prisma.ts` to use the snake_case client field (`auth_user_id`) on write and to map the persisted row to `ProfileEntityProps` (`auth_user_id` -> `authUserId`), leaving domain props, the use case, and the public DTO camelCase; verify the users build/typecheck and `pnpm run verify -- --service users` succeed.
- [x] 3.3 Author a hand-written users forward migration at `libs/users/infrastructure/prisma/migrations/<timestamp>_snake_case_naming/migration.sql` renaming table `UserRecord -> user_profiles`, column `authUserId -> auth_user_id`, and the PK/unique index names; verify it applies against a disposable users database and `prisma migrate status` and `prisma migrate diff` report no drift.
- [x] 3.4 Verify data preservation for users: existing profile rows with their `id` and `auth_user_id` values are unchanged after migration, and a catalog query confirms the final table, column, index, and constraint names are lowercase snake_case.
- [x] 3.5 Run the users contract tests and the authenticated `POST /users` flow; verify the response still exposes public `id` (integer) and `authUserId` (string) with the same `400`/`409` behavior and that `pnpm run validate:openapi -- --service users` passes.
- [x] 3.6 Rename the Prisma model `UserRecord` to `UserProfile` in `libs/users/infrastructure/prisma/schema.prisma` and update generated-client usages from `userRecord` to `userProfile`; verify `pnpm prisma:generate -- --service users`, `pnpm run verify -- --service users`, and Prisma schema diff shows no physical database changes or new migration.

## 4. Convention documentation and identifier strategy record (namespaces: auth, users)

- [x] 4.1 Record the physical PostgreSQL naming convention and the explicit TypeScript casing scope from design decisions 1-3 in the project documentation (`.agents/project-context.md` and/or `docs/architecture-validation.md`) so future services inherit it; verify the document lists the table, column, primary key, foreign key, index, and constraint rules, the `auth_*` prefix exception, and the persistence-snake_case vs Better-Auth/public-contract-camelCase boundary.
- [x] 4.2 Record the identifier strategy from design decision 4 in the same documentation; verify it states that all environments keep `TEXT` id columns, new auth identities are UUID-format via the Better Auth `generateId` function, existing ids are preserved, and a native PostgreSQL `uuid` type conversion is deferred to a separate data-verified change.
- [x] 4.3 Verify no public contract changed and no browser behavior is affected: confirm `libs/auth/specs/openapi.yaml` and `libs/users/specs/openapi.yaml` are byte-for-byte unchanged and that no `apps/web` files were modified by the change.

## 5. Integration checks (namespaces: auth, users)

- [x] 5.1 Run the repo-wide `pnpm run verify` to confirm architecture, domain purity, invariant, and dependency-direction checks still pass after both service migrations and the id-format change.
- [x] 5.2 Run `pnpm test:contract` for the discovered services to confirm cross-service profile-to-identity resolution still works with the standardized names and UUID-format ids, and record the result.
