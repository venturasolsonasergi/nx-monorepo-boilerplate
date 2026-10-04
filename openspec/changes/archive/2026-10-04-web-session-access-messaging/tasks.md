# Tasks

## 1. Update web behavior requirements

- [x] 1.1 [web] Update the authentication, user-management, and navigation deltas for truthful sign-in messaging; verify with `openspec validate web-session-access-messaging --strict`.

## 2. Correct browser messaging

- [x] 2.1 [web] Remove the unsupported `/verified` recovery link and adjust the unauthenticated message and verification-success copy; update affected Playwright assertions and verify with `pnpm web:e2e`.

## 3. Verify and archive

- [x] 3.1 [repo] Run `pnpm web:test`, `pnpm web:build`, `pnpm web:e2e`, and `git diff --check`.
- [x] 3.2 [openspec] Archive only after the web checks pass; verify with `openspec validate --all --strict` and `openspec validate --archived --strict`.