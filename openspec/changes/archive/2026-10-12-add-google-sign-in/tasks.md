# Tasks

## 1. API contract and implementation (auth namespace)

- [x] 1.1 (auth) Update `libs/auth/specs/openapi.yaml`: add required `allowedProviders` (array of provider id strings) to `PublicConfigResponse` and nullable `name` (string) to `AccountSummaryResponse`. Verify: `pnpm openapi:merge` then `pnpm validate:openapi` pass.
- [x] 1.2 (auth) Return `allowedProviders` (configured `socialProviders` keys, sorted) from `GET /auth/public-config` in `libs/auth/infrastructure/auth.controller.ts`, sourced from the existing `AuthConfig`. Extend `libs/auth/tests/auth.contract.spec.ts` and `auth.config.spec.ts`: provider listed when credentials configured, empty list otherwise, no secrets in the payload. Verify: `pnpm api:test -- auth.contract auth.config`.
- [x] 1.3 (auth) Add `name` to `GET /auth/account`: extend `AccountSummaryPrismaReader` to select `user.name` and map an empty value to `null`, and propagate through the account summary use case and port types. Extend `libs/auth/tests/account-summary.spec.ts` and `auth.contract.spec.ts`: provider-named identity returns the name, email-registered identity returns null, unauthenticated returns 401. Verify: `pnpm api:test -- account-summary auth.contract`.

## 2. API host-level return-path coverage (auth namespace)

- [x] 2.1 (auth) Extend the OAuth flow scenario in `apps/api-e2e/test/auth-users.e2e-spec.ts` (stub `test-oauth` provider, following the full browser return path with cookies preserved): after completing the callback, assert `GET /auth/public-config` lists the provider in `allowedProviders` and `GET /auth/account` discloses the provider display name for the new session. Verify: `pnpm api:test:e2e`.

## 3. Web data layer and Google action (web namespace)

- [x] 3.1 (web) Extend `apps/web/src/features/auth/api/auth.api.ts` schemas: `publicConfigResponseSchema` gains `allowedProviders` (array of strings), `accountSummaryResponseSchema` gains nullable `name`. Update `auth.api.test.ts`. Verify: `pnpm web:test`.
- [x] 3.2 (web) Add a shared Google sign-in component and a `useStartOAuth` mutation hook in `features/auth`: render only when public config includes `google` (reuse `usePublicConfig`), disable while the start request is in flight, on success perform `window.location.assign(authorizationUrl)`, on failure show an inline recoverable message and re-enable. Unit tests cover: visible/hidden states (configured, unconfigured, config failure), navigation target, and error handling (mock `window.location`). Verify: `pnpm web:test`.
- [x] 3.3 (web) Add the new UI strings (button label "Continue with Google", pending label, start-failure message) to `features/auth/i18n/en.json`, `es.json`, and `ca.json`. Verify: `pnpm web:test` component tests render localized labels.
- [x] 3.4 (web) Render the Google action on `/login` and `/signup` below the email form (login-page.tsx, signup-page.tsx). Extend `login-page.test.tsx` and `signup-page.test.tsx`: button appears with configured provider, absent without it, email flows unaffected. Verify: `pnpm web:test`.

## 4. Web OAuth callback continuation (web namespace)

- [x] 4.1 (web) Rework `apps/web/src/features/auth/routes/oauth-callback-page.tsx`: without `error`, clear cached profile/settings of any previous caller, revalidate the session (same pattern as `useLogin`), and navigate to `/settings?returnTo=%2Fdashboard`; with `?error=<code>`, show the failure message plus a link to `/login`; if the session cannot be resolved, show a recoverable message plus a link to `/login`. Unit tests cover all three paths with mocked router and query client. Verify: `pnpm web:test`.

## 5. Web profile creation pre-fill (web namespace)

- [x] 5.1 (web) On `/settings`, when `GET /users/me` returns 404, pre-fill the empty name/surname fields from the account summary `name` (first whitespace token as name, remainder as surname, single token leaves surname empty); never overwrite a field the caller already filled; do not apply when a profile exists; address and phone stay empty. Unit tests cover multi-token, single-token, typed-value preservation, and existing-profile cases. Verify: `pnpm web:test`.

## 6. Integration verification

- [x] 6.1 (web) Add browser e2e coverage in `apps/web-e2e` following the existing mocking patterns: Google action visible when configured and hidden when not; successful callback lands on `/settings` and continues per profile state. Verify: `pnpm web:e2e`.
- [x] 6.2 (manual, web+auth) With real Google credentials in `.env` and the consent screen test account added in Google Cloud Console: start from `/login`, complete consent, and observe the return through `/auth/callback/google` to `/settings` (creation form for a fresh Google user, `/dashboard` for an existing one). Record the observed result in the change notes.
  - Observed result (verified manually on 2026-10-12): the flow works end to end - starting from `/login`, completing the Google consent screen returns through `/auth/callback/google` and lands on `/settings` with the session established, as specified.
- [x] 6.3 (web) Run the full web suite: `pnpm web:test`, `pnpm web:build`, `pnpm web:e2e` all pass.
- [x] 6.4 (repo-wide) Run `pnpm verify`, `pnpm lint`, `pnpm validate:architecture`, `pnpm check:dependencies`, and `openspec validate add-google-sign-in --strict`; all pass.
