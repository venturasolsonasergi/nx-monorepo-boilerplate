# Design

## Context

See `proposal.md` - Why. Current state and constraints that shape the approach:

- `apps/web` is a Vite React 19 SPA using TanStack Router (code-based routes composed in `src/app/router.tsx`) and TanStack Query. It is a `web` namespace: no `microservice.json`, no OpenAPI contract, and no Prisma. All user-facing copy is currently hardcoded Spanish (`index.html` declares `lang="es"`; pages and `auth-messages.ts` hold literal strings).
- The profile page lives at `/users` and does double duty: it renders the creation form when `GET /users/me` returns `404` and a read-only view when it returns `200` (`apps/web/src/features/users/routes/users-page.tsx`). The workspace sidebar and header link to `/users`; `/dashboard` and post-login/complete-signup flows also continue to `/users`.
- The `users` service currently exposes `POST /users` (create, email-verified) and `GET /users/me` (read, session-only), backed by `user_profiles` unique on `auth_user_id`. Layering is enforced: domain is free of NestJS/Prisma/Zod, application must not import Prisma, controllers stay thin with repository ports in application.
- `SessionValidationMiddleware` populates `request.authUserId` (and `authEmailVerified`) for every `users` route; the profile read already authorizes on session only.
- `libs/users/specs/openapi.yaml` (version `0.4.0`) is the authoritative HTTP contract; each service's OpenAPI is kept aligned with OpenSpec.

## Goals / Non-Goals

**Goals:**

- Introduce client-side i18n with the locale in the URL, several supported locales, a switcher on every surface, and locale-aware resources.
- Persist a signed-in user's language independently of the business profile, and apply it on sign-in.
- Collect the language in the profile-completion step so a default is always stored.
- Keep the backend contract for settings clean and session-scoped, aligned with the existing profile contract.

**Non-Goals:**

- Editing the business profile fields (name, surname, address, phone); they are displayed read-only on the settings page and can be edited in a later change.
- Regional locale variants; the model should stay additive for them but none are shipped now.
- Localizing backend error messages, auth emails, or developer-facing text.
- A user settings service separate from `users`; settings live in the existing service.

## Decisions

- **Library: `i18next` + `react-i18next`.** Mature, framework-agnostic, with pluralization/interpolation and no extra build step (important for Vitest and Playwright). Alternatives: Lingui and Paraglide (compile-time, smaller runtime, but add a macro/plugin build step and a smaller ecosystem), react-intl/FormatJS (heavier, less ergonomic API). For a boilerplate that newcomers must recognize, the ecosystem-standard option wins; type-safe keys are added via module augmentation.
- **Locale in the URL as a path prefix applied as the TanStack Router basepath.** Every implemented route is served under a `/es`, `/en`, or `/ca` basepath derived from the current URL; the router is the source of truth and prepends the basepath to links and navigation, and validates the prefix against the supported set. Alternatives: a `$locale` path parameter (equivalent URLs but requires threading `params` through every `Link`/`navigate` call site and its tests), a search parameter (worse for shareable/SEO deep links), a subdomain (deployment complexity), or a cookie-only locale (hidden state). Region variants later become additional accepted values with base-language fallback, without restructuring routes.
- **Supported locales are `es`, `en`, `ca`, default `es`.** The set is defined in the web i18n config and validated on the server. They are two runtimes, so the list is duplicated by convention and guarded by a contract test; a shared constant is deferred (see Open Questions).
- **Translation resources are co-located per feature and exposed as i18next namespaces, with a shared `common` namespace.** Each feature owns `features/<feature>/i18n/{es,en,ca}.json` and a thin aggregation in `shared/i18n/config.ts` builds the resource tree (`common` plus one namespace per feature). This matches the existing feature layout and prevents key collisions via namespace prefixes. Alternatives: a single central `locales/` tree (simpler init, weaker locality, larger single files).
- **Resources load statically at startup for now.** With three locales and a small app, static imports keep init and tests trivial; lazy per-namespace loading via a backend plugin is a later optimization.
- **Translation resources are guarded by a consistency test and editable with i18n-ally.** A Vitest test auto-discovers every `{es,en,ca}` bundle and asserts identical key sets and no empty values; `.vscode` configures i18n-ally for inline editing and comparison. i18next-parser is intentionally not adopted because the app uses dynamic and namespaced keys (`t(field.labelKey)`, `settings:languages.${locale}`) that make static extraction unreliable.
- **The signed-in language is authoritative; anonymous entry is detected.** On load, a signed-in caller's stored language wins and the URL is brought to it, even when the request carries a different supported prefix; an anonymous caller keeps a supported URL prefix, else the browser language, else `es`, and an unsupported prefix continues to a supported one.
- **The language switcher is a public-only control; signed-in changes happen in settings.** The shared public header shows the switcher only when no session is active (URL-only change). The workspace shell has no switcher: a signed-in user changes language from the account settings page, which persists via `PATCH /users/me/settings` before navigating. No cookie is introduced, so an anonymous choice lasts for the visit's URL only.
- **A signed-in caller always has a language.** On sign-in, when `GET /users/me/settings` returns `404` the client creates the default `en` with `PATCH /users/me/settings` and applies it, so the signed-in language is fully determined by the account setting; a read failure keeps the locale already in effect.
- **New `user_settings` table in the `users` service, keyed by `auth_user_id`.** A dedicated table keeps preferences separate from the business profile and lets settings exist without a profile (and grow to theme/notifications). Alternative: a `language` column on `user_profiles` (rejected: couples preferences to profile existence and mixes concerns).
- **Settings contract: `GET /users/me/settings` and `PATCH /users/me/settings`.** `GET` returns `200` with `{ language }` when the identity owns settings, `404` when none exist, and `401` without a session. `PATCH` updates only provided fields, creates on first write, returns `200` with the resulting settings, and returns `400` for an unsupported language. Authorized by session only (no email-verification gate), symmetric with the profile read. Alternative: `PUT` with the full object (less friendly to partial updates as settings grow).
- **Layer placement in `users`.** Domain: a `SupportedLanguage` value object and a `UserSettings` entity free of NestJS/Prisma/Zod. Application: a `UserSettingsRepository` port with `UserSettingsNotFoundError`, plus read and update use cases. Infrastructure: the Prisma model/migration, the repository adapter, Zod validation of the request body, the controller handlers, and module wiring.
- **Profile completion submits two requests in order, orchestrating in the web.** On submit the client first `PATCH /users/me/settings` with the language (pre-selected to the active locale, editable) and then `POST /users` with the profile, treating `POST /users` `409` as already-created and continuing. Settings-first guarantees the language even if profile creation fails, and keeps `user_settings` the only writer of the language (one write path, one place to validate). Alternative: `POST /users` also carrying `language` in one atomic call (rejected: two writers and spec overlap with `users/user-settings`). Alternative: binding the language field to an immediate `PATCH` on change (rejected: a user who never touches it would store no default).
- **Sign-in applies the account language, creating a default when absent.** After `POST /auth/login` succeeds, the client resolves `GET /users/me/settings`; a stored language is applied, a `404` creates the default `en` and applies it, and a failed read keeps the locale already in effect (never blocking sign-in).
- **Route rename `/users` -> `/settings` with a compatibility redirect.** The profile page becomes the account settings page holding a read-only profile section and a titled language preference section (with a description and a translated icon); the creation form appears when `GET /users/me` is `404`. Inbound `/users` links and bookmarks are continued to `/settings`. The authorized `returnTo` value (`/dashboard`) and its safety check are unchanged.
- **Document language stays in sync.** The active locale is written to the document's `lang` on change.

## Risks / Trade-offs

- [Supported-locale list drifts between web and users] -> Keep one documented canonical list, validate both sides, and add a contract test asserting the server accepts exactly `es`, `en`, `ca`; revisit a shared constant (Open Questions).
- [Renaming `/users` breaks inbound links/bookmarks] -> Continue `/users` to `/settings`; update every internal link, sidebar item, header item, and post-auth continuation in the same change.
- [Partial failure in the two-request onboarding] -> Sequence settings first (idempotent), treat `POST /users` `409` as success, and surface a recoverable state so the user can retry.
- [Settings read on sign-in could delay or block navigation] -> A missing read creates the default and applies it; a failed read keeps the current locale; neither blocks the sign-in continuation.
- [Static resources grow the initial bundle] -> Acceptable for three locales now; the design leaves room for lazy per-namespace loading later.
- [Existing web tests assert Spanish copy and `/users`] -> Update the affected page, header, sidebar, and navigation tests as part of the change.
- [Locale prefix as an untrusted path value] -> Validate against the supported set; never reflect an arbitrary value into the document or a redirect target.

## Migration Plan

- `users`: one additive migration creating `user_settings` (`user_settings_pkey`, unique `user_settings_auth_user_id_key`, per the repository's naming conventions). Additive, backward compatible; rollback drops the table and the two endpoints.
- Contract: extend `libs/users/specs/openapi.yaml` with the two paths and the settings schema and bump the version; the `web` namespace has no OpenAPI contract.
- `web`: additive localization plus the `/users` -> `/settings` rename with a compatibility continuation; rollback reverts the route and removes the i18n provider and dependencies.
- No coordinated deploy is required: the new endpoints are additive and the web changes are client-side.

## Open Questions

- Where the canonical supported-locale list should live so web and users cannot drift (a tiny shared constant versus a documented convention plus a contract test). Deferrable: it does not change the specs, approach, or task breakdown.
- Whether `x-spec-id` in `libs/users/specs/openapi.yaml` should be generalized now that the document covers settings as well as profile creation. Affects only future tooling.
