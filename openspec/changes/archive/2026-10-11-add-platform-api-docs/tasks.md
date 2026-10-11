# Tasks

## 1. Spike — Scalar reference on Express 5 (platform)

- [x] 1.1 Verify `@scalar/nestjs-api-reference` renders on the existing Express 5 / NestJS 12
  host: install it, register `apiReference({ url: '/docs/openapi.json' })` at `/docs` with a
  temporary inline JSON stub endpoint, run `pnpm api:start:dev`, and open
  `http://localhost:3000/docs`. If incompatible, apply the design D2 fallback (minimal static
  HTML reference page against the same JSON URL) and record the outcome in design.md.
  Verification: browser at `/docs` shows the reference UI pointing at `/docs/openapi.json`;
  remove the stub afterwards.

## 2. Merge script and artifact pipeline (platform)

- [x] 2.1 Add the `yaml` devDependency and an `openapi:merge` script to `package.json`.
  Verification: `pnpm install` succeeds and the merge entrypoint reports the discovered
  services (`auth`, `users`, `orders`) via `scripts/utils/services.ts`.
- [x] 2.2 Implement `scripts/openapi/merge.ts` per design D3/D7: OpenAPI 3.0.3 assertion,
  per-service tag injection, path merge under existing prefixes, component collision
  prefixing with `$ref` rewrite (including security schemes), unique names preserved, single
  `servers` entry, merged `info` block, merged output validated with `SwaggerParser.validate`,
  deterministic (byte-identical) output. Verification: `pnpm openapi:merge` writes
  `apps/api/openapi.json`, exits 0, and a second run is byte-identical.
- [x] 2.3 Add unit tests for tag injection, component collision prefixing + `$ref` rewrite,
  unique-name preservation, and determinism. Verification: tests pass with the repo test
  runner (`pnpm api:test`; if `scripts/` is outside the jest roots, adjust the runner config
  in this task).
- [x] 2.4 Wire the merge into the existing `preapi:*` hooks (`preapi:build`, `preapi:start`,
  `preapi:start:dev`, `preapi:start:debug`), chaining with the existing `prisma:generate`
  hook. Verification: `pnpm api:start:dev` regenerates `apps/api/openapi.json` before the
  API starts (observe the fresh mtime).
- [x] 2.5 Emit the artifact into the build output by extending the post-build copy step
  (pattern of `scripts/copy-prisma-clients.mjs`) or nest build assets. Verification: after
  `pnpm api:build`, `openapi.json` exists under `dist/` next to the compiled host code.

## 3. Host wiring (platform)

- [x] 3.1 Add the `@scalar/nestjs-api-reference` runtime dependency and
  `apps/api/src/platform/docs/configure-docs.ts` registering, in order: the
  `/docs/openapi.json` handler that reads the artifact from disk per request, then the
  Scalar mount at `/docs`; call it from `configure-app.ts`. Verification: with
  `pnpm api:start:dev`, `GET /docs/openapi.json` returns `application/json` with the merged
  document and `GET /docs` returns HTML referencing `/docs/openapi.json`.
- [x] 3.2 Implement `API_DOCS_ENABLED` resolution per design D6 (flag wins; otherwise on
  outside production, off in production), gate both endpoints with it, and document the flag
  in `.env.example`. Verification: host-level tests pass with `pnpm api:test` covering:
  disabled in production by default, explicitly disabled outside production, explicitly
  enabled in production.
- [x] 3.3 Add host-level tests proving existing behavior is unchanged while documentation is
  enabled: the orders health check response is identical, and `auth`/`users` middleware
  behavior is untouched. Verification: `pnpm api:test` and `pnpm api:test:e2e` pass.

## 4. Verify gate and repo hygiene (platform)

- [x] 4.1 Add a freshness/validity gate to the `verify` pipeline: fails when
  `apps/api/openapi.json` is missing, fails OpenAPI validation, or differs from a fresh
  regeneration. Verification: with a temporarily modified source contract and no
  regeneration, `pnpm verify` fails with a freshness error; after `pnpm openapi:merge` it
  passes.
- [x] 4.2 Add `apps/api/openapi.json` to `.gitignore`. Verification:
  `git status --porcelain` shows no generated artifact.
- [x] 4.3 Add the `production-api-docs` entry to `docs/future-features.json` (production
  exposure behind session auth: audience decision, middleware reuse, self-hosted UI bundle,
  spec caching). Verification: the file parses as JSON and the entry is listed.
- [x] 4.4 Update `.agents/sync-openapi.md` so its "Validate and report" step also runs
  `pnpm openapi:merge`, keeping the merged document fresh for the verify gate after any
  service contract sync. Verification: the prompt file documents the re-merge step, and
  following it after a simulated contract edit leaves `pnpm verify` passing.

## 5. Repo-wide checks (platform)

- [x] 5.1 Run the repo-wide gates for a `platform` change — `pnpm verify`, `pnpm lint`, and
  `openspec validate add-platform-api-docs` — with no service-scoped commands for
  `platform`. Verification: all three pass.

## 6. Remove the retired verify-email endpoint (auth)

- [x] 6.1 Remove the deprecated `POST /auth/verify-email` operation and the `GoneError` schema
  from `libs/auth/specs/openapi.yaml`. Verification: `pnpm validate:openapi -- --service auth`
  passes and the generated document contains no `deprecated` operation.
- [x] 6.2 Remove the `retiredVerifyEmail` handler from
  `libs/auth/infrastructure/auth.controller.ts`, the retired-endpoint test from
  `libs/auth/tests/auth.contract.spec.ts`, and the retired-endpoint sentence from `README.md`.
  Verification: `pnpm api:test` passes.
- [x] 6.3 Regenerate `apps/api/openapi.json`, sync the main `auth/identity-sessions` spec, and
  run the repo gates. Verification: `pnpm openapi:merge`, `pnpm verify`, `pnpm lint`, and
  `openspec validate add-platform-api-docs` pass.

## 7. Remove the root scaffolding route (platform, folded in from `remove-api-root-hello`)

- [x] 7.1 Delete `apps/api/src/app.controller.ts`, `apps/api/src/app.service.ts`, and
  `apps/api/src/app.controller.spec.ts`; remove the `controllers: [AppController]` entry and
  its import from `apps/api/src/app.module.ts`. Verification: a search for
  `AppController|AppService|getHello` under `apps/api/src` returns nothing and
  `pnpm api:test` passes.
- [x] 7.2 Add a host-level e2e assertion (e.g. `apps/api-e2e/test/app-root.e2e-spec.ts`)
  that `GET /` responds 404 and `/orders/health` still responds 200 after the removal.
  Verification: `pnpm api:test:e2e` passes.
- [x] 7.3 Run the repo-wide gates — `pnpm lint`, `pnpm verify` (regenerates
  `architecture/dependency-graph.json` after the deletions), and
  `openspec validate add-platform-api-docs`. Verification: all three pass with no
  service-scoped commands for `platform`.
