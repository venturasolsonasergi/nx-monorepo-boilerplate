# Tasks

## 1. users service — domain and persistence (namespace: users)

- [x] 1.1 Add `SupportedThemeValueObject` (`light` | `dark` | `system`) beside `supported-language.vo.ts` and extend `UserSettingsEntity` to validate a `theme` prop; extend the domain unit tests. Verify: `pnpm api:test`
- [x] 1.2 Add `theme TEXT NOT NULL DEFAULT 'system'` to the `UserSettings` Prisma model and create the migration. Verify: `pnpm prisma:migrate` applies cleanly and existing rows read `system`
- [x] 1.3 Extend the get/update settings use cases' input/output to carry `theme` (application layer, no Prisma or NestJS imports); extend `user-settings.use-case.spec.ts`. Verify: `pnpm api:test`

## 2. users service — API contract (namespace: users)

- [x] 2.1 Extend the controller: PATCH `/users/me/settings` zod schema gains `z.enum(['light','dark','system'])` (still `.strict()` and partial) and GET/PATCH responses expose `theme`; extend `users.contract.spec.ts` to cover GET returns the stored theme, PATCH persists a supported theme, creation without `theme` defaults to `system`, an unsupported theme returns `400` and persists nothing, and a language-only PATCH keeps working. Verify: `pnpm api:test`
- [x] 2.2 Update `libs/users/specs/openapi.yaml`: add `theme` to the settings response schema and the PATCH request body with the `light`/`dark`/`system` enum. Verify: `node scripts/validate-openapi.mjs`

## 3. web theming foundation (namespace: web)

- [x] 3.1 Restructure `apps/web/src/styles/globals.css`: move static `@theme` values into `:root` custom properties, add a `.dark` palette block, map tokens via `@theme inline`, and add the `dark` custom variant. Verify: `pnpm web:build` and existing utilities (`bg-background`, `text-muted-foreground`, ...) compile unchanged
- [x] 3.2 Add `apps/web/src/shared/theming/`: storage helpers (single agreed `localStorage` key), the resolver (`light`/`dark`/`system` with `matchMedia` for `system`), and a provider/hook that applies the theme class, tracks live OS scheme changes while on `system`, and writes the cache on change; unit tests with mocked `matchMedia` cover cached dark, no cache, invalid cache, and system switch. Verify: `pnpm web:test`
- [x] 3.3 Add a dependency-free inline pre-paint script to `apps/web/index.html` that reads the same storage key, validates it, and applies the `dark` class before first paint. Verify: `pnpm web:e2e` asserts the dark class from a pre-seeded cache on first paint with no light flash

## 4. web theme surfaces (namespace: web)

- [x] 4.1 Extend the web settings data layer (`settings.schema.ts` gains `theme`) and add a theme section to `/settings` with the three options, applying immediately, writing the cache, and PATCHing the settings; add `ca`/`es`/`en` i18n strings; component tests cover selection applies locally and a persistence failure keeps the session choice. Verify: `pnpm web:test`
- [x] 4.2 Wire signed-in reconciliation in the provider: adopt the theme from the settings response and overwrite the cache when it differs; keep the cached theme when the request fails. Unit tests cover stored-dark-over-cached-light and failure-falls-back. Verify: `pnpm web:test`
- [x] 4.3 Add the anonymous header theme toggle next to `LanguageSwitcher` in `app-header.tsx` (light/dark only, hidden when authenticated); extend `app-header.test.tsx` to cover visibility per session state and the toggle applying and caching the choice. Verify: `pnpm web:test`

## 5. Integration checks (repo-wide)

- [x] 5.1 Run the web build and the full e2e suite, including a signed-in theme selection persisting through the settings API and returning on reload, exercised with the suite's established `page.route` mocks (no live backend or real session cookie). Verify: `pnpm web:build` and `pnpm web:e2e`
- [x] 5.2 Run repo-wide verification covering shared boundaries and the users OpenAPI contract. Verify: `pnpm run verify`
- [x] 5.3 Lint the workspace. Verify: `pnpm lint`
- [x] 5.4 Validate the change artifacts. Verify: `openspec validate add-theme-setting`
