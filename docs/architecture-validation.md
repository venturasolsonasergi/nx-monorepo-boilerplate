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
