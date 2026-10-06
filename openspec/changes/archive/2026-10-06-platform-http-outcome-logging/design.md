# Design

## Context

See proposal.md - Why. The relevant current state is the single request-logging
configuration for the `apps/api` host in
`apps/api/src/platform/observability/logging.config.ts`:

- `customLogLevel` maps every `>= 500` response to `error`, every `>= 400` to `warn`,
  and everything else to `silent`, without inspecting the request.
- `customSuccessMessage` and `customErrorMessage` both return the constant
  `"http request failed"`.

`routeTemplate(request)` in `module-context.ts` already yields the stable route template
(for example `/auth/refresh`) without exposing raw paths or parameter values, so the probe
is identifiable from stable, non-sensitive data.

## Goals / Non-Goals

**Goals:**
- Stop classifying the expected anonymous session probe (`POST /auth/refresh` → `401`) as
  a `warn` failure.
- Keep genuine 4xx/5xx logging exactly as specified: one structured record per response,
  `warn` for 4xx, `error` for 5xx.

**Non-Goals:**
- Any change to the web client's probe behavior or session semantics.
- Reclassifying other 4xx responses (for example a login `401`), which remain genuine
  rejected requests logged at `warn`.

## Decisions

**Detect the probe from stable request data, not the response body.** A predicate checks
`request.method === 'POST'`, `response.statusCode === 401`, and
`routeTemplate(request) === '/auth/refresh'`. Route template is already the sanitized,
non-sensitive identifier used elsewhere in the log record, so this adds no new leakage
surface. Alternative considered: a configurable allow-list of "expected" routes — rejected
as over-general for a single known probe.

**Log the expected probe at `debug`, not `silent`.** The default levels are `info`
(development) and `warn` (production), so `debug` keeps it out of normal output while
leaving it inspectable when a developer raises `LOG_LEVEL` for diagnosis. Alternative
considered: `silent` (matches how successes are handled) — rejected because it removes
even the option to observe probe volume.

**Make the message honest for this case.** The predicate also selects a non-failure
message (for example `"anonymous session probe"`) instead of `"http request failed"`.
Genuine failures keep the existing constant, so no other record changes.

## Risks / Trade-offs

- [Route shape changes] If the refresh route is renamed or mounted differently, the
  predicate stops matching and the probe reverts to `warn` noise → covered by a unit test
  asserting the predicate/output for `POST /auth/refresh` 401 and by keeping the check
  pinned to the route template contract.
- [Over-broad carve-out] Matching on method + status + route is narrow; a genuine `401`
  on another route still logs at `warn`, so audit signal for rejected authentication is
  preserved.
- [Message regression] Both message hooks previously shared one constant; the predicate
  must be applied in whichever hook emits the probe record → covered by asserting the
  emitted record's level and message, not just the level-selection function.

## Migration Plan

No data or contract migration. Behavior changes only for the expected probe; rollback is
reverting the configuration change.

## Open Questions

None.
