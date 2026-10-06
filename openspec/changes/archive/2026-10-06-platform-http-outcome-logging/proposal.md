# Proposal

## Why

The API logs every 4xx HTTP response as a `warn` "http request failed" record. One of
those responses is not a failure at all: `POST /auth/refresh` returning `401` is the
normal, expected answer to the anonymous session probe the web client always performs on
load (the session lives in an HTTP-only cookie, so asking the server is the only way to
know whether a session exists). An anonymous visitor loading any page — including
`/signup` — therefore creates recurring warning noise that hides genuine failures and
misrepresents a normal protocol outcome as an error.

## What Changes

- Classify the anonymous session probe (`POST /auth/refresh` → `401`) as an expected
  outcome: it is no longer emitted as a `warn` "http request failed" failure record.
- Emit that expected outcome at `debug` with an accurate message so it stays available
  for diagnosis without being suppressed as a failure or promoted to a warning.
- Leave every other 4xx/5xx response's logging unchanged: exactly one structured record,
  `warn` for 4xx, `error` for 5xx.
- No change to HTTP status codes or response bodies.

Non-goals: changing when the client probes the session or how it interprets `401`;
changing login or other genuine `401` outcomes; adding request/response body logging;
revisiting log retention or business audit; general reclassification of every 4xx.

## Capabilities

### New Capabilities
<!-- None: this modifies existing logging behavior of the apps/api host. -->

### Modified Capabilities
- `platform/observability-logging`: the requirement to log every 4xx as a `warn` failure
  record is refined so the expected anonymous session probe (`POST /auth/refresh` →
  `401`) is logged as an expected, non-failure outcome instead.

## Impact

- `apps/api/src/platform/observability/logging.config.ts` (`customLogLevel`,
  `customSuccessMessage`/`customErrorMessage`) and its unit tests.
- `openspec/specs/platform/observability-logging` (via this change's delta spec).
- No OpenAPI contract: `platform` has none, and no response status or body changes.
- Verified with the repo-wide checks (`pnpm run verify`, `pnpm lint`,
  `openspec validate`) rather than service-scoped commands.
