# Tasks

## 1. OpenSpec namespace and baseline specs

- [x] 1.1 [openspec] Define the `web/<capability>` namespace convention and backend-only contract-validation wording in `openspec/config.yaml` using only supported keys; verify with `openspec context --json` and a read-through of the file.
- [x] 1.2 [web] Author non-empty deltas `web/authentication`, `web/user-management`, `web/navigation`, and `web/error-handling` from observed behavior with WHEN/THEN scenarios; verify `openspec validate web-persistent-requirements --strict`.

## 2. Browser test infrastructure

- [x] 2.1 [web] Add `@playwright/test`, an `apps/web-e2e` project with a Vite `webServer`, dependency-free smoke specs for the implemented routes and states, and the root `web:e2e` script; verify `pnpm web:e2e`.
- [x] 2.2 [web] Add focused Vitest tests for the auth and users features and the browser API client; verify `pnpm web:test` and `pnpm web:build`.

## 3. Workflow and documentation alignment

- [x] 3.1 [docs] Update `docs/sdd-flow.md`, `README.md`, `.agents/project-context.md`, and `.agents/{sdd,new,ff,apply,verify,enrich-us,code-review}.md` so web capabilities are in scope, backend contract validation is service-only, and web checks are required for web changes.
- [x] 3.2 [docs] Update service-only claims in `.github/prompts/{apply,ff,new,verify}.prompt.md`, `.claude/commands/{apply,ff,new,verify}.md`, and `.opencode/commands/{apply,ff,new,verify}.md`; repoint the missing `.agents/config.json` references to `.agents/project-context.md`.
- [x] 3.3 [docs] Add the frontend e2e scope note to `docs/architecture-validation.md` without changing `architecture/rules.json`.

## 4. Verification and archive

- [x] 4.1 [repo] Run `openspec validate web-persistent-requirements --strict`, `pnpm web:test`, `pnpm web:build`, `pnpm web:e2e`, and `git diff --check`; confirm no backend contract changed.
- [x] 4.2 [openspec] Archive the change once requirements and checks pass; verify `openspec validate --all --strict` and `openspec validate --archived --strict`.
