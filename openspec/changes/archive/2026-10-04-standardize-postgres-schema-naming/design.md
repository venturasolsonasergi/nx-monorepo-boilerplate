# Design

## Context

See proposal.md for motivation and the two delta specs for observable guarantees. The current state, grounded in `libs/*/infrastructure/prisma` and the applied migrations:

- **Auth** (`libs/auth/infrastructure/prisma/schema.prisma`, migration `20261001150355_init_auth`): Better Auth is wired through `prismaAdapter` in `libs/auth/infrastructure/better-auth.adapter.ts`. Physical tables are already plural snake_case with an `auth_` prefix (`auth_users`, `auth_sessions`, `auth_accounts`, `auth_verification_tokens`), but physical columns are camelCase (`emailVerified`, `createdAt`, `userId`, `accessTokenExpiresAt`, ...) and generated index/constraint names contain camelCase (`auth_sessions_userId_idx`, `auth_sessions_userId_fkey`). Identity ids are Prisma `String @id` (Postgres `TEXT`); Better Auth's default id generation produces random strings, and no `advanced.database.generateId` is configured today.
- **Users** (`libs/users/infrastructure/prisma/schema.prisma`, migrations `20260918062237_user_schema_updated` and `20261001152255_profile_auth_user_id`): `UserRecord` has an autoincrementing `Int` primary key and a unique `String authUserId` (Postgres `TEXT`). No `@@map`/`@map` is set, so the physical table is `"UserRecord"` with camelCase columns and PascalCase/camelCase index and constraint names (`UserRecord_pkey`, `UserRecord_authUserId_key`). `authUserId` links to the auth identity across separate databases; there is no PostgreSQL cross-database foreign key.
- **Orders** (`libs/orders/infrastructure/prisma/schema.prisma`): a placeholder `OrderRecord { id String @id }` with no runtime Prisma service and no migrations. It is not a behavior-in-scope namespace for this change.
- **Better Auth version**: `better-auth@1.7.7` (`node_modules/better-auth`, verified). Its option type exposes `advanced.database.generateId?: GenerateIdFn | false | "serial" | "uuid"` (`@better-auth/core` `types/init-options.d.mts`). Two verified runtime details shape the id decision: (1) the generator's `defaultValue` runs `crypto.randomUUID()` when `generateId === "uuid"` (`core/dist/db/adapter/get-id-field.mjs`); (2) the Prisma adapter reports `supportsUUIDs: true` for `provider: "postgresql"` (`@better-auth/prisma-adapter` `dist/index.mjs:461`). Because of (2), the literal `generateId: "uuid"` makes Better Auth *skip* id generation (`shouldGenerateId = !supportsUUIDs`) and expects the database/Prisma to supply the id, which requires a `@default` on the `id` field. A `generateId` **function** (e.g. `() => crypto.randomUUID()`) instead makes Better Auth generate the UUID string in JavaScript and pass it to Prisma, so a plain `String @id` TEXT column works with no default. The `@better-auth/prisma-adapter` `PrismaConfig` also exposes only `provider`, `debugLogs`, `usePlural`, and `transaction` — there is no adapter-level field-rename option, so physical column mapping is owned by Prisma `@map`, not by the adapter.

## Goals / Non-Goals

**Goals:**
- One written physical naming convention for the monorepo, applied to auth and users, so new services (including a future Orders implementation) inherit it.
- A non-destructive path from today's names to the convention that preserves all existing rows and issued identifiers.
- An explicit, justified identifier strategy for identifiers shared across services, with the Better Auth 1.7.7 capabilities actually verified.

**Non-Goals:**
- Changing any public HTTP/OpenAPI contract, response shape, or field type.
- Implementing an Orders runtime service or its migrations.
- Adding a cross-database foreign key between auth and users.
- Reproducing Better Auth's canonical model/field names in the public contract; they stay internal.
- Changing the PostgreSQL storage type (native `uuid`) or rewriting existing id values of already-issued identities; new identities adopt a UUID *format* stored in the existing TEXT columns (see the identifier decision).

## Decisions

### 1. Physical PostgreSQL naming convention

Adopt this convention for durable relational storage in every service:

| Object | Convention | Example |
| --- | --- | --- |
| Table | plural lowercase snake_case, service-owned tables may keep a stable prefix | `auth_users`, `user_profiles` |
| Column | lowercase snake_case | `email_verified`, `auth_user_id`, `access_token_expires_at` |
| Primary key | named `id` | `id` |
| Foreign key column | `<entity>_id`, singular entity | `user_id`, `auth_user_id` |
| Primary key constraint | `<table>_pkey` | `auth_users_pkey` |
| Unique constraint/index | `<table>_<column>_key` | `auth_users_email_key` |
| Non-unique index | `<table>_<column>_idx` | `auth_sessions_user_id_idx` |
| Foreign key constraint | `<table>_<column>_fkey` | `auth_sessions_user_id_fkey` |

PostgreSQL stores unquoted identifiers case-insensitively, but Prisma quotes every identifier, so camelCase columns and PascalCase table names are preserved literally and cause the drift this change removes.

**Explicit TypeScript naming scope** (decided, not left implicit):

| Surface | Casing | Rationale |
| --- | --- | --- |
| Physical PostgreSQL identifiers | snake_case | The convention above; authoritative for the database. |
| Users Prisma model identifier | `UserProfile` (PascalCase) | Names the persisted profile entity in the generated client; `@@map("user_profiles")` independently controls the physical table name. |
| Persistence TypeScript we own: Prisma model fields in the users service, and any hand-written persistence row/raw-SQL types | snake_case | Satisfies "snake_case in the database and in persistence TypeScript" for the code this repo controls. |
| Auth Prisma model/field names | camelCase | Documented exception: these ARE the Better Auth `prismaAdapter` binding, which has no field-rename option; changing them would require Better Auth's per-model `fields` mapping and risks the credential/session contract. Physical columns are still snake_case via `@map`. |
| Public HTTP/OpenAPI DTOs and Better Auth canonical API object names | camelCase | Public contracts are unchanged; the Better Auth API object contract is preserved. |
| Domain entities and application/use-case code (non-persistence) | Stay as-is (camelCase today) | Out of scope for a persistence-naming change; no observable behavior change. |

This makes both halves deliberate: persistence TypeScript we own becomes snake_case, while the two documented camelCase exceptions are Better Auth's adapter binding and the public contracts. The users repository explicitly maps persistence fields (`authUserId` domain prop ↔ `auth_user_id` persistence field) at the infrastructure boundary; domain props keep their current names because they are not persistence types.

Alternative considered: accept camelCase in *all* TypeScript as a pure style exception and only standardize the physical layer. Rejected because it does not meet the original objective of snake_case in TypeScript and the database; the scoped exceptions above are narrower and explicit.

### 2. Applying the convention to the auth schema

Keep the existing table names and the `auth_` prefix. Keep Prisma model names (`User`, `Session`, `Account`, `Verification`) and field names (camelCase) unchanged so `prismaAdapter` and the adapter code in `better-auth.adapter.ts` are untouched — this is the documented "camelCase in Better Auth" TypeScript exception. Add explicit `@map`/`@@map` so the physical layer becomes snake_case, and pin constraint/index names with `map:` so they do not depend on Prisma's derivation:

- `User`: `emailVerified → email_verified`, `createdAt → created_at`, `updatedAt → updated_at`; `@@map("auth_users")` (unchanged).
- `Session`: `expiresAt → expires_at`, `createdAt/updatedAt → created_at/updated_at`, `ipAddress → ip_address`, `userAgent → user_agent`, `userId → user_id`; relation map `auth_sessions_user_id_fkey`; index map `auth_sessions_user_id_idx`; `@@map("auth_sessions")`.
- `Account`: `accountId → account_id`, `providerId → provider_id`, `userId → user_id`, `accessToken → access_token`, `refreshToken → refresh_token`, `idToken → id_token`, `accessTokenExpiresAt → access_token_expires_at`, `refreshTokenExpiresAt → refresh_token_expires_at`, `createdAt/updatedAt → created_at/updated_at`; relation map `auth_accounts_user_id_fkey`; index map `auth_accounts_user_id_idx`; `@@map("auth_accounts")`.
- `Verification`: `expiresAt → expires_at`, `createdAt/updatedAt → created_at/updated_at`; index map `auth_verification_tokens_identifier_idx`; `@@map("auth_verification_tokens")`.
- Rename the PK constraints to `auth_users_pkey`, `auth_sessions_pkey`, `auth_accounts_pkey`, `auth_verification_tokens_pkey` (already snake_case in the applied migration except the names derive from the table, so they already match) and the unique/index names as listed.

Because Prisma does not infer renames, adding `@map` and running `prisma migrate dev` would emit destructive `DROP COLUMN`/`ADD COLUMN` operations and lose data. The migration must be a hand-authored SQL migration that uses `ALTER TABLE ... RENAME COLUMN`, `ALTER TABLE ... RENAME CONSTRAINT`, and `ALTER INDEX ... RENAME TO`, then reconciles Prisma's drift state.

### 3. Applying the convention to the users schema

Rename the Prisma model from `UserRecord` to `UserProfile` and map it to `user_profiles` (plural snake_case). This gives the generated Prisma Client the `userProfile` delegate and uses the profile entity's name rather than the generic storage-record name. The mapping keeps the physical table name `user_profiles`; changing the Prisma model identifier alone requires no SQL migration. Keep the users persistence TypeScript snake_case, since the users service owns its persistence with no external adapter binding:

- `@@map("user_profiles")`, `id` stays the Prisma `Int @id @default(autoincrement())` (physical `id`, sequence-backed) — the public `id` remains a positive integer.
- Rename the Prisma field to `auth_user_id String @unique` (physical `auth_user_id`, unique index `user_profiles_auth_user_id_key`); `name`, `surname`, `address`, `phone` already match and stay. The field name and the physical column are the same snake_case identifier, so no `@map` is needed for it.
- Rename PK constraint `UserRecord_pkey → user_profiles_pkey` and unique index `UserRecord_authUserId_key → user_profiles_auth_user_id_key`.
- The Prisma model is `UserProfile` (PascalCase); its physical table remains `user_profiles` through `@@map`.

The persistence boundary makes the casing change explicit in `libs/users/infrastructure/users.repository.prisma.ts`: the generated delegate is `userProfile`, its field keys use snake_case (`userProfile.create({ data: { auth_user_id, ... } })`), and the repository maps the persisted row to the domain entity (`auth_user_id` → `ProfileEntityProps.authUserId`). Domain props, the use case, and the public `ProfileResponse`/`authUserId` field keep their current camelCase names, because they are not persistence types and changing them would ripple into observable behavior.

### 4. Identifier strategy for cross-service identifiers

**Decision: keep `TEXT` id columns in every environment for now, and issue UUID-formatted ids for newly created auth identities through a Better Auth `generateId` function. Defer the native PostgreSQL `uuid` column type and any conversion of existing values to a separate, data-verified change.**

Rationale and constraints:

- The only cross-service identifier today is the auth identity id, referenced by users as `authUserId`. Auth persists it as `TEXT`; users references it as `TEXT` in a separate database with no FK.
- **One physical schema must fit all environments.** A single Prisma `String` field cannot be native `uuid` in new databases and `TEXT` in existing ones without branching schemas/migrations or a coordinated type migration. To stay non-destructive, this change standardizes on `TEXT` everywhere and does not declare a native `uuid` column.
- **New identities get UUID format.** Configure `advanced.database.generateId` in `better-auth.adapter.ts` to a function such as `({ model }) => crypto.randomUUID()`. Verified against 1.7.7: when `generateId` is a function, Better Auth generates the value in JavaScript and passes it to the Prisma adapter, so the existing `String @id` TEXT column stores a UUID string with **no `@default` and no database extension**. This applies to new user/session/account/verification ids; all their columns are TEXT, so all store UUID strings.
  - Alternative (considered, not chosen): the literal `advanced.database.generateId: "uuid"`. Because the Prisma adapter reports `supportsUUIDs: true` for PostgreSQL, this variant makes Better Auth *skip* generation and rely on a database-supplied default, requiring `id String @id @default(uuid())` (or `dbgenerated("gen_random_uuid()")`) plus a PostgreSQL extension/version dependency. Rejected to avoid adding a schema default and an extension dependency before the native `uuid` decision is made.
- **Existing ids are never rewritten.** Ids issued before this change (Better Auth's default random strings, not necessarily UUID-shaped) are preserved byte-for-byte and remain valid opaque strings. Both legacy values and new UUID-format values satisfy the public `userId`/`authUserId` string contract.
- **Users follows the same TEXT storage.** `users.auth_user_id` stays TEXT and accepts both legacy random strings and new UUID-format strings, with no format assumption anywhere.
- **Forward convention (deferred migration).** Native PostgreSQL `uuid` remains the target for cross-service identifiers, but converting requires confirming every existing `auth_users.id` and `users.auth_user_id` value is UUID-shaped before a cast, or performing an explicit old-string → new-uuid remap across both services together. That decision needs a real dataset (see Open Questions) and gets its own change and migration.
- Sequential numeric ids remain appropriate for the users profile `id`, which is service-local and already exposed publicly as `integer int32`; changing it would be a breaking API change and is out of scope.
- Alternative considered: keep or widen sequential numeric ids for the shared identifier (`BIGINT`/identity, Better Auth `generateId: "serial"`). Rejected because it changes `userId` from a string to a number, breaking the auth response contract, the `authUserId` string in users, and the domain `AuthUserIdValueObject`.

This keeps the identifier strategy explicit and testable (new ids are UUID-format) while honoring the instruction not to propose a destructive migration, not to assume that existing TEXT ids can be cast to UUID, and not to describe two physical types for one field.

### 5. Contract and boundary mapping

- Public HTTP/OpenAPI is unchanged. `libs/auth/specs/openapi.yaml` and `libs/users/specs/openapi.yaml` are not edited. The users response keeps `id` (integer) and `authUserId` (string); the auth responses keep `userId` and their existing status shapes.
- Internal boundary names are unchanged: `libs/auth/infrastructure/session-validation.middleware.ts` still sets `request.authUserId` / `request.authEmailVerified`, and the users controller/use-case still consume `request.authUserId`.
- Better Auth canonical object names are unchanged: the auth Prisma client still exposes `user`, `session`, `account`, `verification` with camelCase fields (the documented TypeScript exception); only the physical columns move via `@map`. The users service, which has no external adapter binding, uses snake_case Prisma fields and maps them to camelCase domain props and public DTOs in the repository. If auth ever needed snake_case Prisma fields, the mapping primitive is Better Auth's per-model `fields` option (verified present in 1.7.7), not `prismaAdapter`; that change is explicitly not taken here.

### 6. Orders

No Orders requirement is introduced. The placeholder `OrderRecord` model and its `id String @id` are noted only because the convention should be applied when Orders is actually implemented; this change makes no decision about Orders identifiers or persistence.

## Risks / Trade-offs

- [Adding `@map` and running `prisma migrate dev` yields destructive drop/add rather than a rename] → Author the rename migration by hand (`ALTER ... RENAME`), regenerate the client, and verify Prisma drift is clean before proceeding.
- [Renaming columns used by indexes/constraints leaves stale index and constraint names] → Rename constraints and indexes explicitly in the same migration; assert final names with a catalog query in the verification task.
- [Better Auth adapter expects a field name that a rename breaks] → In auth keep Prisma model/field names camelCase and map only the physical columns; run auth contract tests and the real signup/verify/login/refresh/logout flows after generation.
- [A later native-UUID migration would fail on legacy non-UUID rows] → Do not change column types or existing values in this change; new ids are UUID-formatted strings stored in TEXT, and any native-type conversion is deferred to a data-verified change covering both services.
- [A generation function could produce an unexpected shape or break existing flows] → Pin the generator to `crypto.randomUUID()`, assert the UUID-format scenario in a test, and confirm legacy ids still resolve.
- [Users snake_case Prisma fields could break the repository or domain mapping] → Rename fields and the `save`/read mapping together, keep domain props and DTOs camelCase, and cover it with the existing users contract tests.
- [Two services could drift if only one adopts the convention] → Apply both deltas in one change and document the convention in design so future services inherit it.

## Migration Plan

1. Author and review the auth rename migration: `ALTER TABLE ... RENAME COLUMN` for every camelCase column, `ALTER TABLE ... RENAME CONSTRAINT` for PK/FK/unique constraints, `ALTER INDEX ... RENAME TO` for non-unique indexes, plus the `auth_*_pkey` names; update `schema.prisma` with matching `@map`/`map:`; run `pnpm prisma:generate -- --service auth` and confirm `prisma migrate diff` / `prisma migrate status` reports no drift. Apply to a disposable database first and confirm row counts and sample values are unchanged.
2. Configure `advanced.database.generateId` in `better-auth.adapter.ts` to `crypto.randomUUID()` so new identities (and new sessions/accounts/verifications) receive UUID-format ids in the existing TEXT columns; do not add any `@default` to the id fields, and do not alter existing rows.
3. Apply the equivalent users rename migration (`UserRecord → user_profiles`, `authUserId → auth_user_id`, index/constraint renames), rename the Prisma field to `auth_user_id`, update the repository read/write mapping to domain props, regenerate, and confirm no drift.
4. Run `pnpm run verify -- --service auth` and `pnpm run verify -- --service users`, plus `pnpm run validate:openapi -- --service <name>` for both, and the auth/users contract tests. Confirm existing profile-to-identity lookups still resolve and that a new signup returns a UUID-format userId.
5. Record the id strategy as convention only; do not change stored id values or column types. The native PostgreSQL `uuid` type and any cast/remap of existing values remain a separate, data-verified change with its own migration and rollback.
6. **Rollback:** the rename migrations are reversible by inverse `ALTER ... RENAME` statements (or by restoring the pre-change database backup); because no data is dropped, rollback restores the previous physical names without data loss. Revert the `generateId` configuration in the same code revert so the generated client and id policy match the database. Existing legacy ids were never changed, so no data repair is needed.

## Open Questions

- Are all existing `auth_users.id` / `users.auth_user_id` values UUID-shaped? The repository provides no data sample, so a future native-`uuid` cast-vs-remap cannot be decided here. This is the data-availability assumption behind keeping TEXT and deferring the native type; it does not block this change, which only gives new ids UUID format while preserving existing values.
- Should the native PostgreSQL `uuid` column type ever be adopted, and if so cast-after-verification or explicit remap across both services? Deferred to a separate change once a data-bearing environment is available.
