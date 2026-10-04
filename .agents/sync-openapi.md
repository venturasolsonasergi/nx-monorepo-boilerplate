# sync-openapi — Synchronize the OpenAPI Contract

This prompt handles the OpenAPI half of Phase 1. It does not create an OpenSpec
change and does not implement application code. It applies only to backend
services: the browser client `web` has no OpenAPI contract, so a `web`-only
change skips this prompt.

## Preconditions

- The user has approved the OpenSpec proposal and its service-scoped delta spec.
- Identify the service from the change artifacts; ask if more than one service is affected and the target is unclear.
- Read the existing `libs/<service>/specs/openapi.yaml` and the complete approved delta for that service.

## Work

Update only the affected service's OpenAPI contract so its paths, request and
response schemas, status codes, and error shapes match the approved requirements.
Preserve unrelated operations and components. Do not invent behavior or derive
the API contract from undocumented implementation behavior; use the approved delta
to determine the contract changes.

## Validate and report

Run `pnpm run validate:openapi -- --service <service>`. Report the exact contract
changes and validation result. If a requirement cannot be represented or conflicts
with the existing API, stop and ask the user to revise the change artifacts before
proceeding.

Do not start implementation. Phase 1 still requires explicit user approval of
the OpenSpec artifacts and synchronized OpenAPI contract.
