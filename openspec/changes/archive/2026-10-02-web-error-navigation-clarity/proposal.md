# Proposal

## Why

Two archived `web` capabilities describe behavior that is broader than what the browser client actually does. `web/error-handling` states internal API-client contracts (credentials, status exposure, schema validation) rather than user-observable behavior, and `web/navigation` presents the unauthenticated `/users` link to `/verified` as a way to recover a session even though the client has no login or verification-request screen. The requirements should match observable behavior and record the missing screen as a deferred dependency.

## What Changes

- Remove the `web/error-handling` requirement "Reject failed browser API responses"; that internal client contract stays covered by web unit tests rather than a behavioral spec.
- Modify the `web/navigation` requirement "Provide in-app links between pages" so the `/verified` link is described factually and the requirement states that the client hosts no login or verification-request screen.
- Record the deferred login/verification-request screen as a release dependency in `design.md`.
- Non-goals: implementing a login or verification-request screen, changing any client or backend behavior, or adding an OpenAPI contract.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `web/error-handling`: Remove the internal browser-API-client requirement and keep the capability focused on visible error states.
- `web/navigation`: Clarify that the unauthenticated link to `/verified` is navigation only and does not start login or verification.

## Impact

- Persistent web specs only; no code, tests, backend contract, Prisma schema, or `architecture/rules.json` change.
- The browser API client keeps rejecting failed responses and validating payloads; that behavior remains asserted by `apps/web/src/shared/lib/api-client.test.ts`.
