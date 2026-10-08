# Proposal

## Why

The browser client is Spanish-only and hardcodes its copy across every page, so it cannot serve users who navigate in Catalan or English, and it cannot remember a signed-in user's language. The platform needs to support Spanish, Catalan, and English now, and each authenticated user's language must live with their account so it follows them across sessions and devices. This is done in the browser layer without asking the HTTP API to translate its machine-readable messages and without touching auth emails, which are deferred.

## What Changes

- Introduce client-side internationalization in `apps/web`: supported locales `es`, `en`, and `ca`, with the locale carried in the URL as a path prefix (`/es/...`, `/en/...`, `/ca/...`) that is the source of truth for the active language.
- Resolve the initial language: a signed-in caller's stored language is authoritative (the URL is brought to it, even if it carries a different prefix); an anonymous caller keeps a supported URL prefix, else the browser language, else a default of `es`, and continues to the locale-prefixed route.
- Present a language switcher in the shared public header only when no session is active; a signed-in user changes language from the account settings page. A public selection changes the URL only.
- Persist a signed-in user's language preference as user settings in the users service, keyed by the session-derived identity and stored independently of the business profile, so future preferences (theme, notifications) can be added without touching the profile.
- Add `GET /users/me/settings` and `PATCH /users/me/settings` to the users service, validating the language against the supported set.
- Move the authenticated profile page from `/users` to `/settings`; the settings page shows the read-only profile and a titled language preference section (with a description and an icon).
- Completing the profile submits two requests in order - `PATCH /users/me/settings` (language) then `POST /users` (profile) - treating a `409` from `POST /users` as already-created and continuing.
- On sign-in, apply the caller's stored language, creating the default `en` when none exists, and continue to the locale-prefixed destination.

**BREAKING (web):** the browser route `/users` is replaced by `/settings`. Internal links and post-authentication continuations are updated. No existing HTTP API contract changes; the new users endpoints are additive.

Non-goals (explicitly out of scope):

- Localizing API error messages; the client keeps mapping status/code to translated copy.
- Localizing auth emails; that is a later change.
- Editing the business profile fields (name, surname, address, phone) after creation.
- Regional locale variants such as `en-GB` or `en-US`; the design keeps them additive.
- Translating OpenSpec artifacts or backend developer-facing text.

## Capabilities

### New Capabilities

- `web/localization`: locale-in-URL internationalization foundation and the authenticated language-preference behavior of the browser client.
- `users/user-settings`: per-identity user settings (language for now, extensible) with session-scoped retrieval and partial update.

### Modified Capabilities

- `web/navigation`: the route surface is locale-prefixed and the profile route becomes `/settings`; the shared header and workspace shell expose the language switcher.
- `web/user-management`: the profile page moves to `/settings`, collects the language preference, and submits the settings and profile requests.
- `web/dashboard`: the shell's profile link and the no-profile continuation point to `/settings`.
- `web/authentication`: post-login and complete-signup continuations target `/settings`; sign-in applies the stored language preference.
- `web/landing`: the root route is served under a locale prefix and a prefix-less request continues to the detected locale.

## Impact

- Namespaces: `web` (browser client `apps/web`) and `users` (microservice `libs/users`).
- `apps/web`: new runtime dependencies (`i18next`, `react-i18next`); a locale-aware route tree; `/users` becomes `/settings`; a settings page with a profile section and a preference section; localized header, shell, and sidebar; shared plus per-feature translation resources.
- `libs/users`: a new `user_settings` table and migration; settings domain/application/infrastructure; `GET /users/me/settings` and `PATCH /users/me/settings`; server-side validation of the supported locales; OpenAPI update and contract tests.
- Tests: web unit/component tests plus `pnpm web:test`, `pnpm web:build`, and `pnpm web:e2e`; users service `pnpm run validate:openapi -- --service users` and `pnpm run verify -- --service users`.
- No changes to `auth`, `orders`, or `platform`.
