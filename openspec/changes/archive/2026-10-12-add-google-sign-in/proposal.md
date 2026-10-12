# Proposal

## Why

The backend already supports Google OAuth end to end (`POST /auth/oauth/google`, `GET /auth/callback/google`), but the browser client offers no way to use it: users can only register and sign in with email. Exposing the existing flow in the UI lets new and returning users authenticate with Google and land in the same profile-completion flow as email users.

## What Changes

- `GET /auth/public-config` additionally returns `allowedProviders`, the list of configured social provider ids (for example `["google"]`), so the client renders sign-in options the API can actually serve. Additive, non-breaking.
- `GET /auth/account` additionally returns `name`, the display name established by the identity provider at first sign-in, so the client can pre-fill the profile creation form. Additive, non-breaking.
- The `/login` and `/signup` routes render a "Continue with Google" action only when `google` appears in `allowedProviders`; activating it starts the OAuth flow (`POST /auth/oauth/google`) and sends the browser to the returned `authorizationUrl`.
- The `/auth/oauth/callback` route, on success, updates the resolved session and continues to `/settings?returnTo=%2Fdashboard` instead of showing a static success page. With an existing profile this continues straight to `/dashboard`; without one it presents the profile creation form. On failure it keeps the current error message behavior.
- The profile creation form on `/settings` pre-fills name and surname from `GET /auth/account`'s `name` (first token as name, remainder as surname) when the caller has no profile yet; the fields remain editable and address/phone stay empty.
- New UI strings for the Google action and its states are added to the `ca`, `en`, and `es` translations.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `auth/identity-sessions`: the public-config requirement now also discloses the configured social providers (`allowedProviders`) alongside the support email.
- `auth/password-management`: the account summary requirement now also discloses the provider display `name` of the session identity.
- `web/authentication`: the OAuth callback outcome requirement changes to adopt the session and continue into the settings flow; a new requirement covers the "Continue with Google" action on `/login` and `/signup` governed by `allowedProviders`.
- `web/user-management`: the profile creation form requirement now pre-fills name and surname from the account summary name.

## Impact

- **API** (`libs/auth`, `apps/api`): `public-config` and `account` responses gain fields; `libs/auth/specs/openapi.yaml` is updated accordingly (additive). Controller, use cases, reader, and contract/unit tests touched. No database migration.
- **Web** (`apps/web`): auth API schema, login/signup pages, OAuth callback page, settings profile creation form, i18n files (`ca`/`en`/`es`), and unit plus browser e2e tests.
- **Compatibility**: both API changes are additive response fields; existing clients ignoring unknown fields are unaffected. The web callback route change is observable only to this client.
- **Non-goals**: no new OAuth providers (GitHub stays configured-but-unexposed), no profile pre-fill for address/phone, no Google sign-up page or separate flow, no changes to email/password flows, no backend session or identity model changes.
