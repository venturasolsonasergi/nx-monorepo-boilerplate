# Design

## Context

`apps/web` is an Nx application tagged `platform:browser`. It has no `microservice.json`, no OpenAPI contract, and no Prisma schema; service discovery and the backend validation flows only read `libs/*/microservice.json`. The client talks to backend services over HTTP through a single credentials-aware API client, and the router is composed from per-feature route factories. There are currently no web test files, and no browser automation dependency.

## Goals / Non-Goals

**Goals:**

- Give the existing, implemented browser behavior a reviewed persistent `web/<capability>` OpenSpec namespace.
- Make browser behavior executable via Vitest and a Playwright smoke suite, without database, email, or live API dependencies.
- Align the SDD workflow so OpenAPI/contract validation is required only for affected backend services.

**Non-Goals:**

- Making `web` a microservice or giving it an OpenAPI contract, Prisma schema, or `microservice.json`.
- Documenting dashboard or settings behavior that does not exist.
- Moving the full API-backed auth journey or database-backed profile creation into web e2e.

## Decisions

- **`web` is an OpenSpec namespace, not a service.** Requirements live at `openspec/specs/web/<capability>/spec.md`; the path is a product-surface namespace, not a service discovered from `microservice.json`. This keeps browser behavior reviewed by OpenSpec while leaving the backend validation flows untouched.
- **Behavior specs reference backend public contracts, not internals.** Web requirements name HTTP endpoints such as `POST /auth/refresh` and `POST /users` as external contracts and never describe backend domain or Prisma internals.
- **Browser e2e uses Playwright with a Vite `webServer`.** Playwright is added as a root devDependency and `apps/web-e2e` launches the Vite dev server on port 4200. Specs cover only implemented routes and UI states, so the suite needs no database, email, or live API. Alternative considered: reusing the Jest/Supertest `apps/api-e2e`, rejected because it is a backend host suite, not browser automation.
- **`web:e2e` is a package script, not an Nx target.** The repository's web workflow uses root `pnpm web:*` scripts; `apps/web-e2e/project.json` exists only for graph metadata (`implicitDependencies: ["web"]`) and defines no targets.
- **Focused Vitest tests satisfy `web:test`.** Vitest is configured with jsdom but has no test files; focused component/unit tests for the implemented features and the API client make the script meaningful and green.
- **No backend contract is touched.** Because the change only adds web behavior and tooling, OpenAPI and contract-test runs are not part of the required gate; `architecture/rules.json` is unchanged.

## Risks / Trade-offs

- Seeding specs from current behavior risks encoding incidental UI text; requirements therefore describe observable outcomes and only quote text where it is the user-visible contract.
- A Playwright smoke suite can be flaky or slow if it depends on the API; the suite is deliberately dependency-free, so it does not prove API-backed journeys, which remain covered by `apps/api-e2e`.
- The four web capabilities overlap at points (for example, unauthenticated fallback appears in both user-management and error-handling); each keeps a distinct requirement focus to avoid near-duplicate specs.
