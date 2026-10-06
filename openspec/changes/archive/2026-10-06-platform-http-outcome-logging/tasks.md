# Tasks

## 1. Classify the expected anonymous session probe

- [x] 1.1 [platform] In `apps/api/src/platform/observability/logging.config.ts`, add a predicate that identifies the expected anonymous session probe from stable request data (`request.method === 'POST'`, `response.statusCode === 401`, `routeTemplate(request) === '/auth/refresh'`) and have `customLogLevel` return `debug` for it while preserving `warn` for other 4xx, `error` for 5xx, and `silent` otherwise; verify with unit tests in `logging.config.spec.ts` that the probe yields `debug` and a non-probe 4xx still yields `warn` (`pnpm api:test -- logging.config`).
- [x] 1.2 [platform] Emit a non-failure message for the probe from the success/error message hooks, leaving the existing `"http request failed"` message for genuine failures; verify with a unit test that emits and captures the record and asserts the probe's level is `debug` with the non-failure message, while a genuine 4xx keeps `warn` and the failure message (`pnpm api:test -- logging.config`).

## 2. Repo-wide verification

- [x] 2.1 [platform] Run the repo-wide checks after implementation — `pnpm run verify`, `pnpm lint`, and `openspec validate platform-http-outcome-logging --strict` — and confirm all pass (never a `--service platform` command).
