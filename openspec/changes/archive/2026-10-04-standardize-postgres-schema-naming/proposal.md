# Proposal

## Why

Physical PostgreSQL identifiers are inconsistent across services: the auth service's Better Auth tables are plural snake_case (`auth_users`, `auth_sessions`, `auth_accounts`, `auth_verification_tokens`) but most physical columns and generated index/constraint names contain camelCase, and the users service persists `UserRecord` with a camelCase `authUserId` column and PascalCase table/index/constraint names. Without one written convention, each new service (and any future Orders implementation) will invent its own physical naming and identifier strategy, and the cross-service identity identifier — the auth user id referenced by users as `authUserId` — has never had an explicit strategy.

## What Changes

- Define one physical PostgreSQL convention for the monorepo: tables plural lowercase snake_case, columns lowercase snake_case, primary key `id`, foreign key `<entity>_id`, and index/constraint names lowercase snake_case.
- Decide the TypeScript casing scope explicitly: snake_case for persistence TypeScript this repo owns (users service Prisma fields and hand-written persistence row types), while Better Auth's adapter binding and the public HTTP/OpenAPI contracts stay camelCase.
- Apply the convention to the auth Prisma schema with `@@map`/`@map` and explicit index/constraint names, preserving the existing Auth table names and prefixes (`auth_users`, `auth_sessions`, `auth_accounts`, `auth_verification_tokens`) and Better Auth's canonical model and API object names.
- Apply the convention to the users Prisma schema: map `UserRecord` to a plural snake_case table, rename the persistence field `authUserId` to `auth_user_id`, and rename indexes/constraints, without changing the public `POST /users` request/response contract.
- Rename the logical users Prisma model from `UserRecord` to `UserProfile`, so the generated Prisma Client delegate is `userProfile`, while keeping the physical table mapped to `user_profiles`.
- Make the identifier strategy an explicit design decision, comparing native PostgreSQL UUIDs against keeping or widening sequential numeric ids for identifiers shared across services, and issue UUID-format ids for newly created auth identities through Better Auth while keeping existing ids and all `TEXT` id columns.
- Preserve existing auth user ids and users references through a non-destructive migration approach; do not rewrite existing id values, and defer any native `uuid` column-type conversion to a separate, data-verified change.
- Keep public HTTP/OpenAPI field names and Better Auth canonical API object names unchanged in this change; describe the boundary mappings needed to reconcile them with the new physical names.
- Non-goals: do not implement Orders behavior, do not add cross-database foreign keys, do not change any public HTTP contract or response shape, do not change existing ids or id column types, and do not implement code or migrations in this planning change.

## Capabilities

### New Capabilities

<!-- None: the convention is recorded in design.md; the observable guarantees attach to the existing capabilities below. -->

### Modified Capabilities

- `auth/identity-sessions`: Identity identifiers issued by auth remain stable, opaque, and unchanged for existing identities, and session validation continues to resolve identities after the physical naming and identifier standardization.
- `users/user-registration`: Profiles continue to link to exactly one auth identity through the same identifier value auth issues, the public `POST /users` contract is unchanged, and existing profiles remain retrievable after the schema naming standardization.

## Impact

- `libs/auth/infrastructure/prisma/schema.prisma`, its applied migrations, and its generated client: `@@map`/`@map` plus renamed indexes/constraints. `libs/auth/infrastructure/better-auth.adapter.ts` gains a `generateId` function so new identities get UUID-format ids; Better Auth's canonical model/field names and the public auth surface are unchanged.
- `libs/users/infrastructure/prisma/schema.prisma`, its applied migrations, and its generated client: table/column mapping and renamed indexes/constraints, the Prisma model renamed to `UserProfile` (delegate `userProfile`), and the persistence field renamed to snake_case; `libs/users/infrastructure/users.repository.prisma.ts` maps it to unchanged domain props. The logical model rename does not change the physical table name or require a database migration.
- A new forward migration per service to rename physical identifiers; existing data and existing id values remain intact and readable. Existing `TEXT` id columns are kept in all environments; only newly created auth identities adopt UUID format. Any native PostgreSQL `uuid` column-type conversion is deferred to a separate, explicit data-verified migration recorded in design.md.
- No changes to `libs/auth/specs/openapi.yaml` or `libs/users/specs/openapi.yaml` public contracts, and no change to `apps/web` behavior.
- Future services, including a real Orders implementation, adopt the documented convention; this change does not define Orders behavior.
