# Tasks

## 1. Contract-first response header (namespace: platform; services: auth, users, orders)

- [x] 1.1 Add the reusable `x-request-id` response header to every declared response in `libs/auth/specs/openapi.yaml`, `libs/users/specs/openapi.yaml`, and `libs/orders/specs/openapi.yaml`; constrain it to 1-128 characters matching `[A-Za-z0-9._-]+`. Keep request schemas and response bodies unchanged.
- [x] 1.2 Validate each synchronized contract with `pnpm run validate:openapi -- --service auth`, `pnpm run validate:openapi -- --service users`, and `pnpm run validate:openapi -- --service orders` before changing runtime behavior.

## 2. Dependency and run-wide logging wiring (namespace: platform)

- [x] 2.1 Add `pino` and `nestjs-pino` as runtime dependencies compatible with Nest 12, and add `pino-pretty` only as a root `devDependency`; verify `pnpm install` succeeds and `pnpm api:build` compiles.
- [x] 2.2 Put logger options and environment selection in a dedicated file under `apps/api/src/platform/observability/` and register it once from `AppModule`: `LOG_LEVEL` override, default `warn` when `NODE_ENV=production`, default `info` otherwise, `service: api` plus environment base fields, raw JSON in production without loading `pino-pretty`, and `pino-pretty` in development. Add no logger configuration to service libraries. Verify dev rendering and production JSON/severity with `pnpm api:start:dev` and a production run.
- [x] 2.3 Add focused tests asserting production/non-production defaults, `LOG_LEVEL` override and filtering, base fields, and that development output preserves the same entry fields as production JSON. Verify `pnpm api:test` passes.

## 3. Request correlation (namespace: platform)

- [x] 3.1 Implement request correlation in the host: reuse only a single `x-request-id` matching `[A-Za-z0-9._-]{1,128}`, otherwise generate a UUID; attach the resolved value to request-scoped entries and the response header, and expose that response header through CORS to trusted browser origins. Verify `pnpm api:test:e2e` passes for trusted-origin and non-browser requests.
- [x] 3.2 Add API end-to-end tests for valid, missing, repeated, malformed, and oversized IDs; assert the response header and captured request-scoped entries carry the resolved value, and trusted browser origins can read the header. Verify `pnpm api:test:e2e` passes.

## 4. Sensitive-data redaction and body exclusion (namespace: platform)

- [x] 4.1 Configure redaction paths for authorization, cookie, set-cookie, token, password, secret, credential, payment-card-number, and card-security-code fields, including nested structured and serialized `err` data; serializers emit safe metadata and omit bodies, raw URLs, query strings, and raw route-parameter values. Verify redaction stays active in development and production.
- [x] 4.2 Add a regression test that captures serialized output with unique sentinel values in sensitive headers and top-level/nested fields (including card data and `err`), and asserts every sentinel is absent while the configured censor marker appears. Also assert request/response bodies and URL secrets are absent on success and failure. Run the test against development and production logger configurations; verify `pnpm api:test` and `pnpm api:test:e2e` pass.

## 5. Module context and error logging (namespace: platform)

- [x] 5.1 Derive child loggers from the single host logger with stable `service: api` and `module: api|auth|users|orders` bindings; component child loggers may add a `component` binding, and request-scoped logs inherit `requestId`. Add no independent logger configuration. Test module/component bindings and request context inheritance; verify `pnpm api:test` passes.
- [x] 5.2 Emit exactly one structured failure record per 4xx/5xx response with `requestId`, `module`, and `http.method`, `http.route`, and `http.statusCode`; use `warn` for 4xx and `error` for 5xx. For unexpected exceptions, include the standard serialized `err` object (type, message, stack when available), with redaction and no bodies or sensitive URL values. Preserve existing HTTP error response bodies/statuses; test record count, fields, severity, serialization, redaction, and that a subsequent request succeeds after a request exception. Verify `pnpm api:test:e2e` passes.

## 6. Platform namespace documentation (namespace: platform)

- [x] 6.1 Update `openspec/config.yaml` context, proposal namespace rules, and archive guidance to recognize `platform` as a cross-cutting runtime namespace alongside discovered microservices and `web`; state that it has no `microservice.json` or OpenAPI contract and stays out of service discovery, Prisma, contract tests, and service-scoped OpenAPI validation. Verify `openspec context --json` resolves the root and `openspec validate add-platform-structured-logging` passes.
- [x] 6.2 Update `.agents/project-context.md` to document the `platform` namespace scope and limits (what it owns and that it must not be treated as a discoverable service or OpenAPI target). Verify the document states the scope, the boundaries, and the prohibition on `--service platform` checks.
- [x] 6.3 Update `docs/sdd-flow.md` to describe `platform` change scoping and its applicable repo-wide checks, without prescribing `--service platform`. Verify the documented workflow distinguishes platform from backend services and `web`.
- [x] 6.4 Keep `production-log-transports` recorded in `docs/future-features.json` with every checklist area classified as covered by this change or deferred; verify the JSON parses and this implementation remains JSON stdout without remote/file destinations.

## 7. Integration checks (namespace: platform; repo-wide)

- [x] 7.1 Run `pnpm run verify -- --service auth` and `pnpm run validate:openapi -- --service auth`; record both results.
- [x] 7.2 Run `pnpm run verify -- --service users` and `pnpm run validate:openapi -- --service users`; record both results.
- [x] 7.3 Run `pnpm run verify -- --service orders` and `pnpm run validate:openapi -- --service orders`; record both results.
- [x] 7.4 Run repo-wide `pnpm run verify`, `pnpm lint`, and `openspec validate add-platform-structured-logging`; record each result. Do not run service-scoped commands for `platform`, and confirm no Prisma schema or `apps/web` behavior changed.
