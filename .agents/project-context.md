# Project Context: NestJS SDD Microservices Boilerplate

## Purpose

Backend boilerplate for building microservices with Spec Driven Development (SDD).
OpenSpec records behavior requirements and change proposals. Each service's
`libs/<service>/specs/openapi.yaml` is its HTTP contract. No behavior-changing code
is written before the OpenSpec change and affected API contract are reviewed.

## Tech stack

- NestJS + TypeScript
- Prisma (infrastructure repositories only)
- Zod (application/infrastructure validation only)
- pnpm workspaces
- Jest (contract tests)

## Project structure

Nx monorepo: NestJS app in `apps/`, per-service code in `libs/`.

```
apps/
  api/                  the NestJS host app (main.ts, app.module.ts) — wires all services together
    src/
  api-e2e/              end-to-end tests for apps/api

libs/
  <service>/            one lib per microservice (discovered via microservice.json)
    specs/
      openapi.yaml             HTTP contract for this service
      context/spec-context.md legacy DDD notes retained during migration
    domain/             pure business logic — no framework, no Prisma, no Zod
      *.entity.ts
      *.vo.ts
      *.domain-service.ts
    application/        orchestrates domain — use cases and repository interfaces
      *.use-case.ts
      *.repository.ts   interfaces only — implementations live in infrastructure
    infrastructure/     NestJS + Prisma — implements interfaces from application
      *.controller.ts
      *.module.ts
      *.repository.prisma.ts
      prisma/           schema.prisma
    tests/              contract tests
  shared/
    domain/             shared domain primitives (allowed in domain + application)
    validation/         shared Zod schemas (allowed in application + infrastructure)
    api-contracts/      reserved for OpenAPI-generated client/types (future frontend)

architecture/           validation engine and rules
scripts/                workflow CLI (not per-service)
.agents/                canonical agent instruction files (tool-agnostic)
docs/                   architecture and workflow documentation
openspec/               shared OpenSpec root; requirements are namespaced per service
  specs/<service>/<capability>/spec.md
  changes/               proposals in progress and archived changes
```

A service is discovered automatically if it has a `microservice.json` file.

## Architecture rules (enforced by validation scripts)

Dependency direction — imports must only flow inward:

```
infrastructure → application → domain
```

Forbidden imports (hard rules — never violate):

- `domain/` must NOT import: `@nestjs/*`, `@prisma/client`, `zod`
- `application/` must NOT import: `@prisma/client`
- One microservice must NOT import from another microservice's `domain/`

Allowed shared usage:

- `domain/` may use: `libs/shared/domain`
- `application/` may use: `libs/shared/domain`, `libs/shared/validation`
- `infrastructure/` may use: `libs/shared/domain`, `libs/shared/validation`

Controllers must be thin — business logic belongs in use cases, not controllers.
Repository implementations live in `infrastructure/` only; `application/` holds interfaces.

## SDD workflow

Use the official OpenSpec workflows in three gated phases. A proposal is not
implementation authorization; wait for explicit review before applying it.

1. **Draft and validate:** optionally explore, propose the change, review every
   requirement and task, then run `openspec validate <change>` and
   `pnpm run validate:openapi -- --service <name>`.
2. **Implement and verify:** apply the approved tasks, run
   `pnpm run test:contract -- --service <name>` and
   `pnpm run verify -- --service <name>`, then use the report-only OpenSpec verify.
   Architecture and dependency checks remain repo-wide.
3. **Archive and prepare commit:** archive only after all checks pass, review the
   merged service capability specs, then prepare a commit summary. Git commit is
   manual and remains the user's action.

Invocation varies by tool: GitHub Copilot/OpenCode use `/opsx-propose`, Claude
uses `/opsx:propose`; see `docs/sdd-flow.md` for all phase commands.

Related skill: `.agents/skills/nestjs-sdd-api-practices/SKILL.md`

## Key conventions

- `microservice.json` — metadata per service (name, version, specVersion, dependencies)
- `sdd-evolution.md` per service — changelog of spec iterations
- OpenSpec capabilities use `openspec/specs/<service>/<capability>/spec.md`
- `libs/<service>/specs/openapi.yaml` remains the HTTP contract for that service

## What NOT to do

- Do NOT write business logic in controllers
- Do NOT import Prisma or NestJS in `domain/`
- Do NOT import across microservice domain boundaries
- Do NOT treat OpenAPI as a replacement for behavioral requirements or vice versa
- Do NOT place a service's persistent requirements under another service's namespace
- Do NOT treat OpenAPI validation as code generation; use `pnpm run validate:openapi`
- Do NOT modify `architecture/rules.json` to silence a validation failure
- Do NOT skip the spec step — always define the OpenAPI before implementing
