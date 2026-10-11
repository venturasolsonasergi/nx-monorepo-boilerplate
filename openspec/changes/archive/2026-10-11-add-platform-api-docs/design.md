# Design

## Context

The API host (`apps/api`) co-hosts the `auth`, `users`, and `orders` service libs, each with
an authoritative hand-maintained OpenAPI 3.0.3 contract at `libs/<service>/specs/openapi.yaml`,
validated by `pnpm validate:openapi` (`@apidevtools/swagger-parser`) and discovered via
`libs/<service>/microservice.json` (`scripts/utils/services.ts`). `@nestjs/swagger` is not
installed; controllers validate with Zod. Bootstrap wiring lives in `configure-app.ts`
(called from `main.ts` before `listen`), and `app.module.ts` scopes
`OriginValidationMiddleware` to `auth`/`users` and `SessionValidationMiddleware` to `users`
only — `/docs` is outside both. The build already runs a post-build copy step
(`scripts/copy-prisma-clients.mjs`) and start/build scripts use `preapi:*` hooks (e.g.
`prisma:generate`). See proposal.md — Why for motivation.

## Goals / Non-Goals

**Goals:**

- Serve the merged contract of all hosted services at one URL with an interactive reference
  UI, without touching service controllers or contracts.
- Keep the API runtime dependency-light: the host only serves an already-generated JSON file.
- Follow existing repo conventions: `preapi:*` hooks, post-build copy script, `LOG_LEVEL`-style
  env override, `verify` pipeline gates, `platform` namespace placement.

**Non-Goals:**

- Any change to `libs/<service>/specs/openapi.yaml` or service controllers (no API contract
  delta; the `platform` namespace gains no microservice.json and no `--service platform`
  check).
- Production exposure, authentication on docs endpoints, or self-hosting the Scalar UI bundle
  (tracked in `docs/future-features.json` as `production-api-docs`).
- Decorator-based contract generation (`@nestjs/swagger`) or typed client generation into
  `libs/shared/api-contracts/`.

## Decisions

### D1. Contract-first serving; no `@nestjs/swagger`

The per-service YAML files remain the only source of truth; the host serves a merge of them.
Decorator-first generation was rejected: it creates a second source of truth that drifts from
the hand-maintained contracts, fights the `sync-openapi` workflow, and requires bridging Zod
(no class-validator DTOs to introspect). Serving is read-only aggregation.

### D2. Scalar via `@scalar/nestjs-api-reference` middleware

`apiReference({ url: '/docs/openapi.json' })` needs no `@nestjs/swagger` and accepts a spec
URL. Alternatives considered: `swagger-ui-express` (dated UX, same architecture), Redoc
(read-only, no request console), Stoplight Elements (heavier). Scalar core is MIT; the UI
loads from a CDN by default — acceptable for a dev-only tool, and the CDN URL can be pinned
for determinism. **The first task is a spike** verifying the middleware works on Express 5 /
NestJS 12 (`platform-express`); if it fails, the documented fallback is serving a minimal
static HTML page that mounts the Scalar reference against the same JSON URL — same
architecture, zero framework dependency.

### D3. Merge runs as a script; the host serves the artifact

Merge logic lives in `scripts/openapi/merge.ts` (TypeScript, run with `tsx`, reusing service
discovery from `scripts/utils/services.ts`) and writes `apps/api/openapi.json`, validating the
result with `SwaggerParser.validate`. Alternatives rejected: merging at API boot (adds a YAML
parser to the runtime, forces the image to ship `libs/` sources anyway, loses the reusable
artifact for future SDK generation, couples boot to contract parsing) and merging per request
(worse). The script is exposed as `pnpm openapi:merge` and wired into the existing
`preapi:build` / `preapi:start*` hook convention (same precedent as `prisma:generate`).

### D4. The JSON endpoint reads from disk on every request

The handler resolves `apps/api/openapi.json` on disk and streams it per request instead of
importing it at build time. Rationale: with `tsx watch`, YAML sources are not imported
modules, so edits would not re-trigger the served document; a disk read lets
`pnpm openapi:merge` refresh the reference without restarting the API, and keeps dev and prod
code paths identical. An ESM/`resolveJsonModule` import was rejected (baked in at build,
stale until rebuild, JSON-to-outDir copy quirks).

### D5. Express-level wiring in `configure-app.ts`; no Nest module or controller

Documentation needs no dependency injection, so `apps/api/src/platform/docs/configure-docs.ts`
registers two middlewares directly, in this order:

1. `GET /docs/openapi.json` — reads and returns the merged JSON.
2. `/docs` — `apiReference({ url: '/docs/openapi.json' })` for the UI.

Order matters: `app.use()` registered before `listen()` runs before the Nest router, so a
Nest controller route would be shadowed by the Scalar mount at `/docs` (returning HTML for
the JSON path). Registering the JSON handler first guarantees it wins. A Nest
`DocsController` was rejected for this reason; a separate JSON path outside the mount was
rejected as a worse URL. Placement is the `platform` namespace (host-level, cross-module),
mirroring observability: `apps/api/src/platform/docs/` holds the wiring helper only — no
domain/application layers are involved, and no database or Prisma impact exists.

### D6. Availability controlled by `API_DOCS_ENABLED` (LOG_LEVEL pattern)

Resolution: explicit `API_DOCS_ENABLED` boolean wins; otherwise enabled outside production
and disabled in production. This mirrors the observability `LOG_LEVEL`/`NODE_ENV` default
pattern, keeps the docs endpoints off in production by default, and pre-creates the flag the
future `production-api-docs` feature will need. The flag is documented in `.env.example`.
The JSON endpoint is gated identically — a merged contract is internal information.

### D7. Deterministic merge rules

- Services discovered via `scripts/utils/services.ts`; tag = service directory name.
- Every operation gets the service tag injected (existing operation tags are preserved after
  it); top-level `tags` declared per service with the service version in the description.
- All sources must be OpenAPI 3.0.3; anything else fails the merge loudly.
- Components (schemas, responses, parameters, security schemes, …): a name declared by more
  than one service is prefixed with the service name for **all** declaring services
  (deterministic, no first-wins), and every `$ref` inside that service's document is
  rewritten; unique names keep their original form.
- `servers` collapses to a single entry (same origin as the host); the merged document gets
  its own `info` block (generic title; per-service versions live in tag descriptions).
- Output is deterministic (same inputs → byte-identical output) so the freshness gate can
  compare bytes.

### D8. Generated artifact is gitignored; freshness enforced by `verify`

`apps/api/openapi.json` is generated (gitignored). The `verify` CLI gains a gate that fails
when the artifact is missing, fails `SwaggerParser.validate`, or differs from a fresh
regeneration. This resolves commit-vs-generate ambiguity and makes forgetting to regenerate a
CI error instead of a stale-docs surprise.

### D9. Remove the NestJS scaffolding root route

The default `GET /` returning `"Hello World!"` (`app.controller.ts` / `app.service.ts`) is
scaffolding: no OpenAPI contract covers it, no client, proxy, or container healthcheck
consumes it, and liveness is observable through the contract-covered per-service health
endpoints (`users/service-health`, `orders/service-health`). Removing it keeps the host
surface contract-only. No replacement root endpoint: a future host-level liveness route would
be its own `platform` capability, not scaffolding residue. Folded in from the smaller
`remove-api-root-hello` change; verified by a host-level e2e asserting `GET /` → 404 while
`/orders/health` stays 200.

## Risks / Trade-offs

- [Scalar middleware incompatible with Express 5 / NestJS 12] → Spike is task 1; fallback is
  a static HTML reference page against the same JSON URL (no framework dependency).
- [A future global middleware in `configure-app.ts` intercepts `/docs`] → Host-level test
  asserts the JSON content type and UI HTML; ordering rule documented at the wiring site.
- [Merge ambiguity (unexpected component collisions, spec drift, version mismatch)] → Merge
  fails loudly instead of guessing; merged output validated with `SwaggerParser.validate`.
- [Docs accidentally exposed in production] → Default-off in production, documented flag,
  `production-api-docs` tracked separately with an auth design.
- [CDN unavailable (offline dev)] → Dev-only tool; version-pinned CDN URL optional; bundle
  self-hosting deferred with the production feature.
- [Extra build step slows startup] → Merge is three small YAML reads; negligible.

## Migration Plan

Additive change: add scripts, dependencies, wiring, and gates. No existing endpoint, schema,
or database behavior changes. Rollback is a revert: remove the wiring call, the script, and
the dependencies; the gitignored artifact disappears with the working tree.

## Open Questions

None material. Cosmetic details (merged `info` title wording, exact tag descriptions) are
deferred to implementation without affecting specs or task structure.
