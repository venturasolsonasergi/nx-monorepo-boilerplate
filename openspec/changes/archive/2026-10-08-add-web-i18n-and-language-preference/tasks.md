# Tasks

## 1. Users settings contract first (namespace: users)

- [x] 1.1 Extend `libs/users/specs/openapi.yaml` with `GET /users/me/settings` (session cookie security, `200` referencing a `UserSettingsResponse` with `language`, `401`, `404`) and `PATCH /users/me/settings` (session cookie security, request body `UpdateUserSettingsRequest` with `language`, `200`, `400`, `401`), add the settings schemas and reuse the existing unauthorized/not-found/bad-request errors, and bump the document version. Verify the contract parses with `pnpm run validate:openapi -- --service users`.
- [x] 1.2 Reconcile the updated contract with `users/user-settings` (session-only authorization, `GET` `404` when no settings exist, `PATCH` upsert on first write, `400` for a language outside `es`/`en`/`ca`, public field `language` only) and confirm the change validates with `openspec validate add-web-i18n-and-language-preference`.

## 2. Users settings domain and application (namespace: users)

- [x] 2.1 Add a `SupportedLanguage` value object (`es`, `en`, `ca`) and a `UserSettings` entity under `libs/users/domain/`, free of NestJS, Prisma, and Zod, rejecting an unsupported language on construction. Verify `pnpm validate:architecture` and `pnpm check:dependencies` pass.
- [x] 2.2 Add a `UserSettingsRepository` port (find by authUserId, upsert) and a `UserSettingsNotFoundError` alongside the existing profile errors in `libs/users/application/`, plus read and update use cases that return a flat public settings object. Verify with unit specs: `pnpm api:test -- libs/users/tests/user-settings.use-case.spec.ts`.

## 3. Users settings persistence and HTTP (namespace: users)

- [x] 3.1 Add a `UserSettings` Prisma model to `libs/users/infrastructure/prisma/schema.prisma` mapped to `user_settings` with `user_settings_pkey` and a unique `user_settings_auth_user_id_key`, run the migration with `pnpm prisma:migrate -- --service users -- --name add_user_settings`, then `pnpm prisma:generate`, and implement the repository adapter in `libs/users/infrastructure/`. Verify the generated client and adapter compile via `pnpm api:test -- libs/users/tests/users.contract.spec.ts`.
- [x] 3.2 Add `GET /users/me/settings` and `PATCH /users/me/settings` handlers to `libs/users/infrastructure/users.controller.ts` (session-only authorization, `401` without a session, `404` when no settings exist on read, Zod-validated `language`, `400` for unsupported values, upsert on write) and wire them in `libs/users/infrastructure/users.module.ts`. Extend `libs/users/tests/users.contract.spec.ts` with `200`, `404`, `401`, `400`, and identity-isolation cases (a client-supplied identifier never selects or modifies another identity's settings). Verify with `pnpm api:test -- libs/users/tests/users.contract.spec.ts`.
- [x] 3.3 Add an e2e case in `apps/api-e2e/test/auth-users.e2e-spec.ts` where identity A creates settings and reads them back, identity B with no settings receives `404` and cannot see or modify A's settings even when supplying A's identifier, and an unauthenticated request receives `401`. Verify with `pnpm api:test:e2e`.

## 4. Users service verification (namespace: users)

- [x] 4.1 Run `pnpm run validate:openapi -- --service users` and `pnpm run verify -- --service users` and confirm both pass with the new settings capability.

## 5. Web internationalization foundation (namespace: web)

- [x] 5.1 Add `i18next` and `react-i18next` to `package.json`, create `apps/web/src/shared/i18n/config.ts` (supported locales `es`/`en`/`ca`, default `es`, base-language fallback) with a `common` namespace and type augmentation for translation keys, and initialize the provider in `apps/web/src/main.tsx`. Verify `pnpm web:build` succeeds.
- [x] 5.2 Serve every implemented route under a locale basepath (`/es`/`/en`/`/ca`) validated against the supported set, continue a prefix-less request to the chosen locale (stored preference, then browser language, then `es`), and continue an unsupported prefix to a supported one, without restructuring the feature route composition in `apps/web/src/app/router.tsx`. Add tests for prefix rendering, prefix-less continuation, and unsupported prefixes; verify with `pnpm web:test`.
- [x] 5.3 Add the language switcher to the shared public header (shown only when no session is active), keep the document `lang` aligned with the active locale, and persist a signed-in user's selection made from the account settings page with `PATCH /users/me/settings` while changing only the URL when signed out. Add tests for the signed-in and signed-out paths; verify with `pnpm web:test`.
- [x] 5.4 Replace hardcoded Spanish copy with per-feature resources under `apps/web/src/features/<feature>/i18n/{es,en,ca}.json` (landing, auth, dashboard, users/settings) aggregated by the shared config, and update the affected page/header/sidebar tests to assert through the active locale rather than literal strings. Verify with `pnpm web:test`.

## 6. Web account settings, route rename, and auth language (namespace: web)

- [x] 6.1 Rename the `/users` route to `/settings`, continue inbound `/users` requests to `/settings`, and update the sidebar item, the header menu entry, the dashboard no-profile continuation, the login and complete-signup continuations, and the OAuth callback link. Verify with `pnpm web:test` and `pnpm web:e2e`.
- [x] 6.2 Build the `/settings` page with a read-only profile section when `GET /users/me` returns `200` and a creation form when it returns `404`, where the form collects the profile fields plus a language preference pre-selected to the active locale and editable, and on submit issues `PATCH /users/me/settings` first and then `POST /users`, treating a `POST /users` `409` as already-created and continuing. Verify the flow with `pnpm web:test` and `pnpm web:e2e`.
- [x] 6.3 Apply the account language on sign-in: after `POST /auth/login` succeeds, resolve `GET /users/me/settings` and continue under the stored locale, creating the default `en` (and applying it) when the read returns `404`, and keeping the locale already in effect when the read fails. Verify with `pnpm web:test` and `pnpm web:e2e`.
- [x] 6.4 Confirm the browser build succeeds with `pnpm web:build`.

## 7. Integration and repo-wide verification (namespaces: web, users)

- [x] 7.1 Add browser end-to-end coverage for the sign-up profile-completion flow issuing the settings and profile requests in order and for the language switcher persisting a signed-in choice, and verify with `pnpm web:e2e`.
- [x] 7.2 Run the repo-wide checks `pnpm run verify`, `pnpm validate:architecture`, `pnpm check:dependencies`, and `pnpm lint` and confirm all pass.
- [x] 7.3 Verify the change set validates with `openspec validate add-web-i18n-and-language-preference`.

## 8. Translation tooling (namespace: web)

- [x] 8.1 Add a resource consistency test that asserts every `es`/`en`/`ca` bundle exposes the same keys and no empty value (`apps/web/src/shared/i18n/resources.test.ts`); verify with `pnpm web:test`.
- [x] 8.2 Add the i18n-ally editor configuration for the per-feature locale files (`.vscode/settings.json`) and recommend the extension in `.vscode/extensions.json`.
