# Proposal

## Why

The monorepo already maintains an authoritative OpenAPI contract per service
(`libs/auth/specs/openapi.yaml`, `libs/users/specs/openapi.yaml`, `libs/orders/specs/openapi.yaml`,
validated by `pnpm validate:openapi`), but nothing serves or visualizes them: a developer
working on the API has no way to browse the HTTP surface of all modules in one place. This
change adds a developer-facing API reference endpoint to the API host, backed by Scalar, so
the full endpoint inventory (`/auth/*`, `/users/*`, `/orders/*`) can be consulted from a
single URL during development.

## What Changes

- Add a deterministic merge script (`scripts/openapi/merge.ts`) that reads every service's
  authoritative `openapi.yaml`, injects a per-service tag (`auth`, `users`, `orders`), merges
  paths and components (colliding component names are prefixed per service, `$refs` rewritten),
  collapses `servers` to the single API origin, and writes `apps/api/openapi.json`, validating
  the merged document with `SwaggerParser.validate`.
- Add dev-only documentation endpoints to the `apps/api` host:
  - `GET /docs/openapi.json` serves the merged document (read from disk per request).
  - `GET /docs` serves the Scalar API reference UI (`@scalar/nestjs-api-reference` middleware)
    pointing at the merged document.
- Documentation endpoints are disabled by default in production and controlled by an
  `API_DOCS_ENABLED` environment flag following the existing `LOG_LEVEL`-style override pattern
  (flag wins; otherwise on outside production, off in production).
- Wire the merge into the existing `preapi:*` hook convention so the generated document is
  refreshed before build/start, extend the build artifact copy step so `apps/api/openapi.json`
  reaches `dist/`, and add a freshness + validity gate to the `verify` pipeline.
- Add `production-api-docs` to `docs/future-features.json` recording the future intent to
  expose the documentation in production behind authentication.
- Remove the retired password-free `POST /auth/verify-email` endpoint and its `GoneError`
  schema from the auth service's authoritative contract, controller, and tests, and update the
  auth spec and README accordingly. `GET /auth/verify-email` (the activation-link redirect) is
  unaffected.
- Remove the undocumented NestJS scaffolding route `GET /` (`"Hello World!"`) together with
  `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`, and their registration
  (folded in from the `remove-api-root-hello` change). No OpenAPI contract or OpenSpec
  capability covers `GET /`, and liveness is already observable through the per-service
  health endpoints.

## Capabilities

### New Capabilities

- `platform/api-docs`: Cross-cutting runtime capability of the `apps/api` host that serves a
  merged OpenAPI document built from every service's authoritative contract and a Scalar
  reference UI at `/docs`, enabled by default only outside production. Covers the observable
  HTTP behavior of the documentation endpoints and the deterministic merge contract (tags,
  paths, components, servers).

### Modified Capabilities

- `auth/identity-sessions`: Remove the retired password-free `POST /auth/verify-email` behavior
  (`410`) from the verify-email requirement. Password-based completion at
  `POST /auth/signup/complete` and the `GET /auth/verify-email` activation-link redirect are
  unchanged.

## Impact

- **Code**: `apps/api` bootstrap (`configure-app.ts`, new `apps/api/src/platform/docs/` wiring
  helper), new `scripts/openapi/merge.ts`, build artifact copy script, `verify` CLI gate;
  `libs/auth/specs/openapi.yaml`, `libs/auth/infrastructure/auth.controller.ts`, and
  `libs/auth/tests/auth.contract.spec.ts` (retired `POST /auth/verify-email` removal);
  deletion of `apps/api/src/app.controller.ts`, `apps/api/src/app.service.ts`,
  `apps/api/src/app.controller.spec.ts`, and the `controllers` registration in
  `apps/api/src/app.module.ts` (root scaffolding removal).
- **Dependencies**: `@scalar/nestjs-api-reference` (runtime, `apps/api`), `yaml` (devDependency,
  merge script only).
- **Scripts/config**: `package.json` (`openapi:merge` script, `preapi:*` hooks), `.gitignore`
  (`apps/api/openapi.json` is generated), `.env.example` (`API_DOCS_ENABLED`).
- **Compatibility**: The two documentation endpoints are additive and disabled in production by
  default. The retired password-free `POST /auth/verify-email` is removed, so it now returns
  `404` instead of `410`; because there is a single client and a single API version, no
  compatibility shim is retained. The root `GET /` route returns `404` like any other
  unrouted path. No other HTTP behavior changes; no database or migration impact.
- **Non-goals**: Exposing documentation in production (tracked in `docs/future-features.json`
  as `production-api-docs`); authentication on the docs endpoints; adopting `@nestjs/swagger`
  or decorator-based contract generation; self-hosting the Scalar UI bundle (defaults to CDN);
  any change to service controllers or their contracts other than removing the retired
  `POST /auth/verify-email`.
