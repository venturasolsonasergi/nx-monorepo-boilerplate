# sdd — Three-Phase OpenSpec Router

`docs/sdd-flow.md` is the canonical reference for phases, gates, commands, and
service extraction; read it for the full flow. OpenSpec's generated `/opsx-*`
workflows own proposal, implementation, verification, and archive behavior. Do
not reimplement those workflows or cross a phase gate without explicit user
approval.

If the affected namespace is unclear, inspect `libs/` for `microservice.json` and
the browser client `web`; ask the user to choose. A change may name more than one
namespace.

Retained helpers beyond the `/opsx-*` workflows:

- `/sync-openapi` — synchronize an approved backend delta into its
  `libs/<service>/specs/openapi.yaml` (Phase 1).
- `/repo-checks` — run the executable service/OpenAPI and repo-wide checks
  (Phase 2); distinct from the report-only `/opsx-verify`.
- `/code-review` — run final checks and prepare the commit summary (Phase 3).

## Phase 1 — Draft and Validate

1. If behavior or scope is unclear, use `/opsx-explore` (Claude:
   `/opsx:explore`).
2. Create the change with the matching propose command. Review `proposal.md`,
   every namespaced delta spec, `design.md` when present, and `tasks.md`.
3. Use `/sync-openapi` to synchronize each affected backend service's OpenAPI
   contract, then run the Phase 1 validation commands from `docs/sdd-flow.md`:

   - `openspec validate <change>`
   - `pnpm run validate:openapi -- --service <service>` for each affected backend service

   A `web`-only change has no OpenAPI contract: skip `/sync-openapi` and the
   OpenAPI validation, keeping only `openspec validate <change>`.
4. Stop at the Phase 1 gate until the user approves both OpenSpec artifacts and
   any affected OpenAPI contracts.

## Phase 2 — Implement and Test

Use `/opsx-apply` (Claude: `/opsx:apply`). Complete tasks one at a time. Then use
`/repo-checks` to run the OpenAPI validation and `verify` checks for the affected
services (`verify` already includes the service-scoped contract tests and the
repo-wide architecture, domain purity, invariant, and dependency checks). For
`web` changes, run `pnpm run verify` plus `pnpm web:test`, `pnpm web:build`, and
`pnpm web:e2e` instead of OpenAPI checks. Run OpenSpec's report-only
`/opsx-verify` separately. Do not archive while a check or task is incomplete.

## Phase 3 — Archive and Prepare Commit

After Phase 2 passes, use `/opsx-archive` (Claude: `/opsx:archive`). Review the
merged service spec and archive path. Use `/code-review` to prepare the final
summary and conventional commit message. Never run `git add`, `git commit`, tag,
or push; those remain the user's actions.

See `docs/sdd-flow.md` for the exact commands, service extraction guidance, and
phase exit criteria.
