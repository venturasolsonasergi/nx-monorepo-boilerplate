# Design

## Context

See proposal.md for motivation. Current state grounded in the repository:

- `apps/api/src/main.ts` boots `AppModule` with `NestFactory.create(AppModule)` and `configureApp` (CORS only). `AppModule` imports `AuthModule`, `UsersModule`, and `OrdersModule`, and applies `OriginValidationMiddleware` and `SessionValidationMiddleware`. All three services run in one process.
- There is no logging configuration today: no `Logger`, no `pino`, no `winston`, and no request-id handling in `apps/api` or `libs/*` (verified by search). `main.ts` uses Nest's default bootstrap.
- `apps/api-e2e` drives the host app with `supertest`; `apps/api` has Jest unit tests. Scripts are `pnpm api:test` and `pnpm api:test:e2e`; repo-wide checks are `pnpm run verify` (architecture, domain purity, invariants, contract tests) and `pnpm lint`.
- Architecture rules (`architecture/rules.json`) forbid `domain/` from importing `@nestjs/*`, `@prisma/client`, and `zod`, and enforce the `infrastructure -> application -> domain` direction. `platform` logging is runtime infrastructure, so it MUST NOT reach domain code.
- `openspec/config.yaml` currently defines a namespace as a discovered microservice (`libs/<service>/microservice.json`) or the browser client `web`. Service discovery and OpenAPI validation (`scripts/`, `pnpm run validate:openapi`) only understand discovered services; `web` is the existing documented exception.

## Goals / Non-Goals

**Goals:**

- One run-wide logging configuration for the API process with per-module context, no per-service logger instances or per-service configuration.
- Observable, testable behavior for levels, correlation, redaction, body exclusion, and error logging.
- Domain and application code stay free of logging concerns.
- `platform` recorded as an explicit OpenSpec namespace exception that does not enter service discovery, Prisma, contract tests, or OpenAPI validation.

**Non-Goals:**

- Durable business audit, log shipping, retention, or queryability.
- Logging request/response bodies, including any opt-in.
- Per-microservice logging configuration or per-microservice logger instances.
- Changing any `libs/<service>/specs/openapi.yaml`, any Prisma schema, or `apps/web`.
- Treating `platform` as a discoverable microservice with an OpenAPI contract.

## Decisions

### 1. Logging library: Pino via nestjs-pino

**Decision: use Pino with `nestjs-pino` as the operational logging implementation.**

Rationale:

- Pino emits structured JSON records natively with low overhead, which matches the "single structured record" requirement.
- `nestjs-pino` integrates with the Nest lifecycle, supports a single `LoggerModule.forRoot(...)` configuration, exposes a request-scoped `PinoLogger`, and supports `genReqId`, custom serializers, and `redact` paths — covering correlation, module context, and redaction in one place.
- It integrates with Nest's built-in logger so framework logs share the same structured output.

Alternatives considered:

- **Nest `Logger` alone.** Rejected: no built-in per-request correlation, redaction, or structured record production; would require rebuilding the same behavior.
- **Winston.** Rejected: heavier configuration for the same structured-output outcome, and Pino's redaction/serializer model is more direct for the required guarantees.

The exact `pino`/`nestjs-pino` versions compatible with Nest 12 are verified at apply time; the behavioral requirements in the delta spec do not depend on the library. Use `pino-pretty` only as a development formatter, declared in `devDependencies`; production must not load the pretty transport.

### 2. Single configuration, per-module context

**Decision: configure logging exactly once in the API host (`AppModule`), then derive contextual child loggers from that shared logger.**

- Keep logger options and environment-based transport/level selection in a dedicated host configuration file under `apps/api/src/platform/observability/`; `AppModule` imports and registers that configuration exactly once.
- The shared root logger carries `service: api` and the configured environment. Each host/module logger is a Pino child with one stable binding: `module: api`, `module: auth`, `module: users`, or `module: orders`. Component-specific child loggers MAY add a `component` binding while inheriting the module field; do not create a new logger per method or request.
- Request-scoped correlation is added by the HTTP integration so request log records inherit `requestId` together with the module binding. Child loggers only add context; they do not create separate levels, transports, redaction rules, or destinations.
- No `LoggerModule` (or any logger configuration) is added to `libs/<service>` modules, and no service owns a separate logger instance.

Boundary placement: correlation middleware, serializers, and the global exception filter live in the host (`apps/api`) or in a platform area under `apps/api` (for example `apps/api/src/platform/observability`). If service infrastructure emits logs, it does so through the injected Nest/Pino logger with a context label; `domain/` and `application/` remain logging-free. This keeps the change inside the infrastructure/host layer and preserves the dependency direction.

### 3. Request correlation via `x-request-id`

**Decision: accept an inbound `x-request-id`, generate one when absent, attach it to all request-scoped entries, and return it in the `x-request-id` response header.**

- `genReqId` reuses exactly one inbound header value only when it matches `[A-Za-z0-9._-]{1,128}`; a missing, repeated, oversized, or malformed value is replaced with a generated UUID. The resolved id is assigned to the request and becomes a base field on every entry emitted while handling it.
- The resolved id is written back to the response `x-request-id` header so callers can correlate.
- CORS exposes `x-request-id` to the configured trusted origins, so browser clients can read it on cross-origin responses.
- The inbound value is treated as untrusted; invalid values are never copied into logs or response headers, avoiding response-header injection and unbounded log fields.

Alternative considered: generate a fresh id always and ignore the inbound header. Rejected because it breaks caller-side correlation across hops.

### 4. Redaction and body exclusion

**Decision: redact a defined secret set and never serialize request/response bodies.**

- Configure a redaction path set covering at least: `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`, and token/password/secret/credential fields at the top level and nested in structured fields. Redacted values are replaced with a fixed marker, never partially masked.
- Customize request/response serializers to emit only safe metadata (method, route template, status, latency, correlation id, module) and explicitly omit bodies, raw URLs, query strings, and raw route-parameter values, keeping the exclusion guarantee even on error paths.
- Redaction is always active; it is not environment-conditional. Only the output format (structured production vs human-readable development) and the minimum level are configurable.

### 5. Output format and level control

**Decision: structured records in production, human-readable in development; minimum level from environment configuration with an informational default.**

- Production: each entry is one structured record on standard output.
- Development: use `pino-pretty` for human-readable rendering while preserving the same entry fields as production JSON. Declare it only in `devDependencies` and activate it only outside production; production writes Pino JSON directly to standard output without the pretty transport.
- Minimum level is controlled by `LOG_LEVEL` and defaults to `warn` when `NODE_ENV=production`, or `info` in non-production environments. Redaction stays on in both modes.

### 6. Error logging and request resilience

**Decision: use one structured HTTP failure record with consistent severity and fields; preserve existing response contracts.**

- Emit exactly one failure record per HTTP response with status 4xx or 5xx: `warn` for 4xx and `error` for 5xx. Include `requestId`, `module`, and an `http` object with method, route template, and status code.
- When an unexpected exception causes a 5xx, serialize it under Pino's conventional `err` field (type, message, and stack when available). Use the configured error serializer and redaction; do not attach request/response bodies, raw URLs, or arbitrary exception properties.
- Use the request completion/error logging path as the single owner of this record. Do not also log the same failure from a filter, controller, and middleware. Keep the existing HTTP status and response body schema from each service's contract unchanged; this change standardizes the operational log, not the API error payload.
- An unexpected exception during one request is converted to its existing HTTP error response and does not prevent subsequent requests from being served. Fatal process failures outside request handling are not covered.

### 7. `platform` as an OpenSpec namespace exception

**Decision: add `platform` as an explicit cross-cutting runtime namespace, not a microservice and not `web`.**

- `platform` owns no HTTP contract and no service-owned domain; it describes runtime concerns that span every module in the API process. This change creates `openspec/specs/platform/observability-logging/spec.md`.
- It is not a microservice: no `libs/platform/microservice.json`, so `scripts/utils/services.ts` discovery and `pnpm run verify -- --service platform` / `pnpm run validate:openapi -- --service platform` do not and must not apply. Tasks MUST NOT invent `--service platform` checks.
- `openspec/config.yaml` is updated so its context, proposal namespace rule, and archive guidance recognize `platform` as a cross-cutting runtime namespace alongside the existing service and `web` namespaces. `.agents/project-context.md` and `docs/sdd-flow.md` document its scope and checks.
- Alternative considered: place the capability under an existing service namespace (for example `users/observability-logging`). Rejected: the behavior spans all modules and the host process, so a service namespace would misattribute ownership and imply a service-scoped contract.

### 8. Separation from business audit

**Decision: operational logs are not an audit trail.**

- This capability provides no retention, durability, or queryability guarantee and MUST NOT be used to record business facts or decisions.
- Durable business audit, if ever required, is a separate capability with its own storage and requirements; this change adds none.

## Risks / Trade-offs

- [Human-readable development output is not machine-parseable] → Keep the structured production format authoritative for the requirement; development formatting preserves the same fields.
- [Redaction path lists drift as new secret-bearing fields are added] → Centralize the redaction set in one place and cover redaction with tests for headers and nested fields; require new secret-carrying fields to be added to the set.
- [Trusting an inbound `x-request-id` enables log forging or header injection] → Validate length/shape and fall back to a generated id; reuse the validated value in the response header.
- [Pino/nestjs-pino version incompatibility with Nest 12] → Verify compatible versions during apply and adjust the adapter wiring without changing the observable guarantees.
- [Instrumenting inside `libs/*` could leak logging into `domain/`/`application/`] → Keep wiring in the host/platform layer and require a repo-wide architecture check to stay green.
- [A per-service logger could be introduced later] → The namespace documentation and the single-configuration requirement make per-service loggers an explicit violation.
- [HTTP failures could be logged twice by request middleware and exception handling] → Make one host-level request completion/error path responsible for the failure record and test that only one record is emitted.
- [Serialized exception messages or stacks could expose sensitive values] → Use the error serializer, avoid arbitrary exception properties, apply redaction, and test representative sensitive values; never attach request/response payloads.

## Migration Plan

1. Add the chosen logging dependency/config once in the host, derive child loggers with module context, and wire correlation, CORS exposure, safe serializers, redaction, format/level selection, and one request error logging path.
2. Add tests for module child bindings, redaction, request correlation (inbound reuse and generation, response header), structured output, body exclusion, and standardized error records without duplicates.
3. Add `x-request-id` response-header documentation to all declared responses in the auth, users, and orders OpenAPI contracts, and update `openspec/config.yaml`, `.agents/project-context.md`, and `docs/sdd-flow.md` for the `platform` namespace.
4. Run API tests, OpenAPI validation and service-scoped verification for auth, users, and orders, plus repo-wide verification, lint, and `openspec validate add-platform-structured-logging`.
5. **Rollback:** revert the host wiring, CORS exposure, OpenAPI response-header additions, namespace documentation, and added dependency. No persisted data or request/response body schema changes are introduced.

Production log shipping/transports beyond JSON stdout are deferred and tracked in `docs/future-features.json` as `production-log-transports`. The inventory also distinguishes checklist items covered by this change from deferred production hardening such as external destination level limits, high-volume log review, build-version metadata, and child loggers for future background jobs. Collector selection, retention, retries/backpressure, and production destinations are outside this change.
