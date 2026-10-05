# Proposal

## Why

The NestJS host in `apps/api` currently has no structured, correlated operational logging, and there is no written guarantee that secrets in headers, cookies, tokens, credentials, or URLs are kept out of log output. As auth, users, and orders run in one process, the runtime needs one shared logging contract with a run-wide configuration and per-module context, without introducing per-service loggers or hidden duplication.

This change also forces a deliberate OpenSpec structural decision: the only recognized namespaces today are discovered microservices and the browser client `web`. Operational logging is a cross-cutting runtime capability owned by no single service and by no browser surface, so it needs an explicit `platform` namespace exception rather than being forced into a service namespace.

## What Changes

- Add a new cross-cutting capability, `platform/observability-logging`, that defines observable requirements for structured operational logging in the API process: levels, service/module context, per-request correlation, and error handling.
- Control levels through `LOG_LEVEL`, defaulting to `warn` in production and `info` in non-production environments, and include stable service, environment, and module context in records.
- Require redaction of credentials, cookies, tokens, passwords, payment card numbers, card security codes, and other secrets, backed by tests that inspect captured serialized logs; request and response bodies are never logged.
- Accept a valid inbound `x-request-id`, generate one when it is absent or invalid, return the resolved value in the response header, and expose that header to permitted browser origins.
- Document the response header in the OpenAPI contracts for auth, users, and orders. This changes response metadata but not response bodies, status codes, or request schemas.
- Require that operational logging stays separate from durable business audit: this capability MUST NOT be used to record business facts or to replace an audit trail.
- Choose Pino with `nestjs-pino` as a design decision (not a behavioral requirement), configured once for the whole API process, with child loggers bound to `module: auth`, `module: users`, `module: orders`, or `module: api`; use `pino-pretty` only in development as a dev dependency, and do not load it in production; explicitly no independent logger configuration per microservice.
- Standardize operational error records: one record per failed HTTP request, `warn` for 4xx and `error` for 5xx, with request/module/HTTP metadata and a serialized `err` object for unexpected exceptions. Preserve existing HTTP error response bodies and status contracts.
- Record `platform` as an explicit, documented OpenSpec namespace for cross-cutting runtime capabilities, distinct from discovered microservices and from `web`.
- Keep service discovery, Prisma flows, and service tests intact; update only the affected OpenAPI response-header documentation, with no request or response body schema changes.
- Non-goals: implementing durable business audit, recording request/response bodies (including via opt-in), adding per-service logger instances or per-service logging configuration, changing request or response body schemas, changing `apps/web` behavior, and treating `platform` as a discovered microservice or OpenAPI-validation target.

## Capabilities

### New Capabilities

- `platform/observability-logging`: cross-cutting operational logging behavior for the API process, covering level control, service/module context, per-request correlation, sensitive-data redaction, body-logging prohibition, error logging, and separation from business audit.

### Modified Capabilities

<!-- No existing business capability requirement changes; the cross-cutting response-header behavior is owned by platform/observability-logging and reflected in the affected OpenAPI documents. -->

## Impact

- `openspec/config.yaml`: broaden the namespace definition so `platform` is recognized as an explicit exception for cross-cutting runtime capabilities, not a microservice and not the `web` product surface; keep the existing discovery, Prisma, contract-test, and OpenAPI-validation rules for microservices and `web`.
- `.agents/project-context.md`: document the `platform` namespace scope and its limits so it is not mistaken for a discoverable service and stays out of service discovery, Prisma, contract tests, and OpenAPI validation.
- `apps/api` runtime: one logging configuration in a dedicated host file (Pino/`nestjs-pino` runtime dependencies and development-only `pino-pretty`, documented in `design.md`), request-correlation wiring, error logging, and redaction; service modules (`auth`, `users`, `orders`) use child loggers with distinguishable module context but do not own logging configuration.
- `apps/api` and `apps/api-e2e` tests: new tests for sensitive-data redaction, per-request correlation, structured output, and error logging; run with the existing API/host test commands.
- `docs/future-features.json`: track production log shipping/transports as deferred work; this change emits JSON to stdout and does not configure remote or file destinations.
- `libs/auth/specs/openapi.yaml`, `libs/users/specs/openapi.yaml`, and `libs/orders/specs/openapi.yaml`: document `x-request-id` on declared responses; `apps/api` CORS exposes the response header to permitted browser origins. No request or response body schema changes.
- `openspec/config.yaml`, `.agents/project-context.md`, and `docs/sdd-flow.md`: document `platform` as a cross-cutting runtime namespace and clarify its checks and boundaries.
- No Prisma schema or migration change, no `apps/web` behavior change, and no `platform` entry in service discovery or service-scoped OpenAPI validation.
