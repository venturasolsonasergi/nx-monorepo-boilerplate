# Design

## Context

The auth microservice already runs the full Google OAuth flow (see proposal.md - Why): `POST /auth/oauth/:provider` returns an authorization URL and sets the Better Auth state cookie; `GET /auth/callback/:provider` validates state, exchanges the code, links or creates the identity, sets the session cookie, and redirects to the web route `/auth/oauth/callback` (or that route with `?error=<code>`). The web client already has `authApi.startOAuth()` (apps/web/src/features/auth/api/auth.api.ts) and the callback route; only the entry point and the post-callback continuation are missing.

Two public responses need additive fields:

- `GET /auth/public-config` currently returns `{ supportEmail }` (libs/auth/infrastructure/auth.controller.ts). The configured social providers are already known at startup: `loadAuthConfig` registers `socialProviders` only when client credentials exist, and `allowedProviders` is derived from them (libs/auth/infrastructure/auth.config.ts).
- `GET /auth/account` currently returns `{ email, hasPassword, passwordUpdatedAt }`. Better Auth stores the provider display name in the `user.name` column (libs/auth/infrastructure/prisma/schema.prisma); the account summary reader just does not select it (libs/auth/infrastructure/account-summary.reader.prisma.ts).

On the web, `/settings` already implements the "complete your profile" flow: `GET /users/me` → 404 → creation form (name, surname, address, phone + language) → `PATCH /users/me/settings` then `POST /users` → continue to the authorized `returnTo`; 200 → continue directly. The callback only needs to route into it.

## Goals / Non-Goals

**Goals:**

- Single source of truth for which social providers the UI offers: the API's configuration, exposed through the existing public-config endpoint.
- Post-OAuth journey identical to email users: session adoption, then the existing `/settings` profile-completion machinery.
- Zero schema migrations; additive-only contract changes.

**Non-Goals:**

- New providers (GitHub stays config-ready but unexposed until its own change), profile pre-fill for address/phone, any separate "Google signup" flow, changes to identity/session persistence, changes to the email/password flows.

## Decisions

1. **Expose providers through public-config, not a frontend build flag.** `GET /auth/public-config` returns `allowedProviders` taken from the configured `socialProviders` keys, sorted for deterministic output. The API is the only component that knows whether Google is actually usable; a `VITE_*` flag would be a second source of truth baked at build time that can disagree with the API (button shown but flow returns 400). Alternative considered and rejected in exploration: frontend environment variable.

2. **Add `name` to the account summary.** `AccountSummaryPrismaReader.read` adds `name` to the `user` select and maps an empty string to `null` (Better Auth creates `''` for email-registered users; Google populates it at first sign-in). The OpenAPI schema gains `name: { type: string, nullable: true }`. The auth service keeps exposing a *display name* only; it never splits name/surname - that is presentation logic owned by the web (consistent with "Keep identity independent of profile data").

3. **Name/surname split lives in the web creation form.** First whitespace token → name, remainder → surname, single token → surname empty; only empty fields are pre-filled, and only when the profile is missing. Rationale: the form exists precisely for the caller to review and correct; a backend "smart split" would embed guesswork in the API contract.

4. **Start the flow with a full-page navigation.** After `POST /auth/oauth/google` succeeds, the web does `window.location.assign(authorizationUrl)` - not a client-side route navigation, because the URL is on `accounts.google.com`. The start request is sent with credentials included so the response's `better-auth.state` cookie is stored before navigation and arrives back on the callback GET (GET is a safe method, so the origin middleware does not block the provider's return request).

5. **The callback page becomes a continuation page.** On success it invalidates/refreshes the session query (same pattern as `useLogin`: drop cached profile/settings of any previous caller, revalidate session) and navigates to `/settings?returnTo=%2Fdashboard`. The existing authorized-returnTo machinery on `/settings` then continues to `/dashboard` (profile exists) or presents the creation form and continues after creation. Failure paths (`?error=` or unresolvable session) show a message with a link to `/login`. Alternative considered: keep the static success page - rejected because the session state in the header would be stale until an unrelated refetch.

6. **Shared Google action component.** One component + one `useStartOAuth` mutation hook in `features/auth`, used by both `/login` and `/signup`; visibility driven by the existing `usePublicConfig` query (`staleTime` 5 min). A failed config request renders no button but leaves email flows untouched. New strings go into the three `features/auth/i18n/*.json` files.

7. **Contract changes stay in `libs/auth/specs/openapi.yaml`** (`PublicConfigResponse`, `AccountSummaryResponse`) and are covered by the existing contract/e2e suites (apps/api-e2e already exercises OAuth with a stub `test-oauth` provider and expects the Google callback URL shape). No other namespace's contract changes; the web namespace has no OpenAPI contract.

## Risks / Trade-offs

- [Google consent screen in Testing mode only allows listed test accounts] → Document in tasks that the OAuth test account must be added in Google Cloud Console during development; the code paths are covered by the stub-provider e2e and unit tests without real Google.
- [Button appears only after public-config resolves (brief late render)] → Acceptable progressive enhancement; email forms are usable immediately and the config query is cached 5 minutes.
- [Empty `name` for email-registered identities could confuse the pre-fill] → Mapped to `null` and the pre-fill only fills empty fields; the scenario "no display name" is covered in specs and unit tests.
- [State cookie lost if the start request is made without credentials] → The mutation uses the shared API client that always includes credentials; e2e asserts the return path preserves cookies.
- [Callback lands on `/settings` while the session cookie is still being written] → The redirect happens server-side before the browser follows it; the settings session check re-resolves via `POST /auth/refresh`, and an unresolvable session falls back to the recoverable message per spec.

## Migration Plan

No database migration. Deploy order: API first (additive fields are ignored by the current client), then web. Rollback: redeploy the previous web build; the API fields are inert. No feature flag needed - the button is governed by runtime API configuration (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` presence).
