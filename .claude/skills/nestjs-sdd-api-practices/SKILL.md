---
name: nestjs-sdd-api-practices
description: 'Use when implementing, reviewing, or refactoring NestJS API code in this boilerplate. Applies to controllers, modules, use cases, repositories, Prisma adapters, OpenAPI-driven changes, and microservice boundaries under the SDD workflow.'
---

# NestJS SDD API Practices

## When to Apply

Use this skill when:

- Adding or changing API endpoints in a microservice
- Implementing application logic after an OpenAPI change
- Wiring NestJS controllers, modules, and infrastructure adapters
- Reviewing whether a change respects SDD and layer boundaries
- Refactoring repository, use case, or controller code in `src/<service>/`

Do not use generic NestJS guidance when it conflicts with this repository's SDD
workflow, dependency rules, or microservice boundaries.

## Source of Truth

- `openspec/specs/<service>/<capability>/spec.md` is the persistent behavioral contract
- `openspec/changes/<change>/specs/<service>/<capability>/spec.md` records a change delta
- `libs/<service>/specs/openapi.yaml` is the HTTP contract and must agree with those requirements
- Implement behavior only after the OpenSpec change is reviewed and approved

Preferred flow:

1. `/opsx:explore` clarifies behavior and affected service capabilities when needed
2. `/opsx:propose` drafts requirements, design, and implementation tasks
3. Review the artifacts, then validate the change and each affected OpenAPI contract
4. `/opsx:apply` implements the approved tasks; run service-scoped tests and repo-wide architecture checks
5. `/opsx:verify` reports implementation/spec mismatches; `/opsx:archive` syncs and archives after all gates pass

## Non-Negotiable Rules

### `spec-openapi-first`

Never implement behavior before the OpenAPI spec exists for that change.

### `layer-inward-dependencies`

Imports must only flow inward:

`infrastructure -> application -> domain`

### `layer-domain-purity`

Code in `domain/` must stay framework-free.

Forbidden in `domain/`:

- `@nestjs/*`
- `@prisma/client`
- `zod`

### `layer-application-isolation`

`application/` orchestrates use cases and ports. It must not import `@prisma/client`.

### `microservice-no-cross-domain-imports`

One microservice must not import another microservice's `domain/`.

### `openapi-contract-sync`

Keep the service OpenAPI contract aligned with observable behavior. OpenSpec does not generate application code in this repository.

## Implementation Rules

### `controller-thin`

Controllers live in `infrastructure/` and stay thin.

- Accept transport input
- Delegate to a use case or application service
- Return transport output
- Do not embed business rules, persistence logic, or cross-service orchestration

### `usecase-owns-application-logic`

Business application flow belongs in `application/use-cases/`.

- A use case coordinates domain objects and repository ports
- A use case should not know Prisma details
- A use case should not depend on Nest transport concerns unless there is a strong adapter reason

### `repo-ports-in-application`

Repository interfaces belong in `application/*.repository.ts`.

- Define ports in application
- Implement them in `infrastructure/*.repository.prisma.ts`
- Keep Prisma-specific query details out of domain and application

### `prisma-in-infrastructure-only`

Prisma schemas, clients, and persistence adapters belong only in `infrastructure/`.

### `shared-usage-whitelist`

Allowed shared imports:

- `domain/` may use `src/shared/domain`
- `application/` may use `src/shared/domain` and `src/shared/validation`
- `infrastructure/` may use `src/shared/domain` and `src/shared/validation`

## NestJS-Specific Guidance in This Repo

Use NestJS as an adapter layer, not as the center of the design.

- `@Controller()`, `@Module()`, and HTTP wiring stay in `infrastructure/`
- Dependency injection should wire ports to implementations at the infrastructure boundary
- Prefer constructor injection
- Keep modules focused per microservice
- Avoid circular dependencies; extract shared behavior or use domain events instead

## Validation and Review Checklist

Before considering a change done, verify:

1. The OpenSpec change was reviewed and approved before implementation.
2. The affected OpenAPI contract matches the approved behavior requirements.
3. Controllers remain thin and business rules are not in NestJS adapters.
4. Prisma stays in infrastructure and application/domain imports respect layer rules.
5. No forbidden cross-service domain imports were introduced.
6. OpenSpec-generated workflow files were not edited manually.
7. Service contract tests, OpenAPI validation, repo-wide architecture checks, and OpenSpec verification pass.

## Anti-Patterns

Avoid these patterns:

- Writing business logic directly in controllers
- Importing Prisma from `application/` or `domain/`
- Importing NestJS decorators or exceptions into `domain/`
- Using Zod in `domain/`
- Editing OpenSpec-generated workflow files manually
- Skipping the spec step and coding from assumptions
- Bypassing repository ports with direct infrastructure access from application

## Local Anchors

Use these files as the local pattern baseline:

- `libs/orders/infrastructure/orders.controller.ts`
- `libs/orders/application/create-order.use-case.ts`
- `libs/orders/application/order.repository.ts`
- `libs/orders/infrastructure/orders.repository.prisma.ts`
- `.agents/project-context.md`
- `docs/sdd-flow.md`
- `architecture/rules.json`
