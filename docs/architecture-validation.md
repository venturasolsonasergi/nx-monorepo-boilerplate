# Architecture Validation

This project includes an architecture validation harness under `architecture/validation-engine`.

## What it validates
- Layer boundaries.
- Forbidden imports.
- Domain purity.
- Controller thinness and repository Prisma encapsulation (by structure and import checks).
- Microservice autonomy.

## Commands
- `pnpm run validate:architecture`
- `pnpm run check:dependencies`
- `pnpm run validate:domain`
- `pnpm run check:domain-invariants`

## Frontend scope
The browser client (`apps/web`) and its Playwright suite (`apps/web-e2e`) are a
product surface, not microservices. Service discovery and the layer/microservice
rules here do not apply to them. Frontend checks are `pnpm web:test`,
`pnpm web:build`, and `pnpm web:e2e`; `architecture/rules.json` is unchanged.

## Physical database conventions
Physical PostgreSQL identifiers use lowercase snake_case (`<table>_pkey`,
`<table>_<column>_key`, `<table>_<column>_idx`, `<table>_<column>_fkey`), with
`id` primary keys and `<entity>_id` foreign keys. The `auth_*` table prefix is
preserved. Persistence TypeScript this repo owns uses snake_case; Auth Prisma
model/field names, Better Auth canonical API names, and public HTTP/OpenAPI DTOs
stay camelCase. Identifiers shared across services stay stored in `TEXT`
columns; newly created auth identities are UUID-format via Better Auth
`advanced.database.generateId`, existing ids are preserved, and a native
PostgreSQL `uuid` column conversion is deferred to a separate data-verified
change. See `.agents/project-context.md` for the full convention table.
