# Design

## Context

The baseline `web` specs were seeded from observed behavior in a prior change. A review found that `web/error-handling` mixed an internal API-client contract into behavioral requirements, and that `web/navigation` implied the unauthenticated `/users` link recovers a session. In fact the `/verified` route only reports the result of following an emailed link; there is no in-client login or verification-request screen.

## Goals / Non-Goals

**Goals:**

- Keep web specs limited to user-observable behavior.
- State the navigation link's real scope and record the missing screen.

**Non-Goals:**

- Building a login or verification-request screen.
- Changing client code or tests.

## Decisions

- **Remove, not reword, the internal API-client requirement.** HTTP status exposure and payload validation are implementation detail verified by unit tests, not a user-facing contract. It stays covered by `apps/web/src/shared/lib/api-client.test.ts`.
- **Describe the `/verified` link as navigation only.** The requirement keeps the observable link but no longer implies recovery; the absent login/verification-request screen is recorded here as a **release dependency** instead of being encoded as expected user recovery.
- **No code change.** The Playwright smoke suite and the Vitest tests already assert the retained behavior.

## Risks / Trade-offs

- Removing a requirement slightly reduces spec coverage of the client's error semantics; this is accepted because that contract is intentionally internal and test-owned.
- Until a login/verification-request screen exists, the unauthenticated `/users` state is a dead end for a brand-new user. The spec now makes that explicit; the screen itself remains follow-up work.
