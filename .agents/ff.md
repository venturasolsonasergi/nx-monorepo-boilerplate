# ff — Validate Phase 1 Artifacts

This legacy shortcut validates an already reviewed OpenSpec change and the
OpenAPI contracts for its affected services. It generates no application code.

## Preconditions

- The change name and affected services are known.
- The proposal, delta specs, tasks, and any required OpenAPI updates have been reviewed.

## Steps

1. Run `openspec validate <change>`.
2. For each affected backend service, run `pnpm run validate:openapi -- --service <service>`. A `web`-only change has no OpenAPI contract, so this step is skipped.
3. Report failures without modifying the artifacts. Resolve contract/spec mismatches in Phase 1, then rerun both validators.

The Phase 1 gate is explicit user approval of the validated artifacts. Do not
call `pnpm generate:spec`, `pnpm apply`, or claim that generated artifacts exist.
