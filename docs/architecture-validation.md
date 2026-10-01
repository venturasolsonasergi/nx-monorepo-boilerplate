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
