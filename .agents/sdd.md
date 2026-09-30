# sdd — Three-Phase OpenSpec Guide

Use this prompt as a workflow router. OpenSpec's generated `/opsx-*` workflows
own the proposal, implementation, verification, and archive behavior. Do not
reimplement those workflows or cross a phase gate without explicit user approval.

If the affected service is unclear, inspect `libs/` for `microservice.json` and
ask the user to choose. A change may name more than one service.

## Phase 1 — Draft and Validate

1. If behavior or scope is unclear, use `/opsx-explore` in Copilot/OpenCode or
   `/opsx:explore` in Claude Code.
2. Create a change with the matching propose command. Review `proposal.md`, every
   service-namespaced delta spec, `design.md` when present, and `tasks.md`.
3. Wait for the user's explicit approval before synchronizing OpenAPI or starting
   implementation.
4. Use `/new` to synchronize each affected `libs/<service>/specs/openapi.yaml`
   from the approved delta, then use `/ff` to run:

   - `openspec validate <change>`
   - `pnpm run validate:openapi -- --service <service>` for each affected service

Stop at the Phase 1 gate until the user approves both OpenSpec artifacts and
OpenAPI contracts.

## Phase 2 — Implement and Test

Use `/opsx-apply` in Copilot/OpenCode or `/opsx:apply` in Claude Code. Complete
tasks one at a time. Then use `/verify` to run the service-scoped contract and
OpenAPI checks plus repo-wide architecture checks. Run OpenSpec's report-only
verify workflow separately. Do not archive while a check or task is incomplete.

## Phase 3 — Archive and Prepare Commit

After Phase 2 passes, use `/opsx-archive` in Copilot/OpenCode or
`/opsx:archive` in Claude Code. Review the merged service spec and archive path.
Use `/code-review` to prepare the final summary and conventional commit message.
Never run `git add`, `git commit`, tag, or push; those remain the user's actions.

See `docs/sdd-flow.md` for the exact commands, service extraction guidance, and
phase exit criteria.
