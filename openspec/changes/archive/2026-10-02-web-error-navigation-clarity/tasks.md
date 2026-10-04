# Tasks

## 1. Spec clarity

- [x] 1.1 [web] Remove the internal `web/error-handling` API-client requirement and clarify the `web/navigation` link scope; verify `openspec validate web-error-navigation-clarity --strict`.

## 2. Review follow-ups

- [x] 2.1 [web] Make the Playwright `webServer` working directory explicit and confirm `pnpm web:e2e` still passes.
- [x] 2.2 [docs] Confirm the archive guidance in `openspec/config.yaml` is namespace-conditional and the `project-context.md` OpenAPI rule is limited to backend contract changes.

## 3. Verification and archive

- [x] 3.1 [repo] Run `pnpm web:test`, `pnpm web:build`, `pnpm web:e2e`, and `git diff --check`.
- [x] 3.2 [openspec] Archive the change; verify `openspec validate --all --strict` and `openspec validate --archived --strict`.
