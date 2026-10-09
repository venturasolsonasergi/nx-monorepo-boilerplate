# Design

## Context

The users service already stores per-identity preferences (`UserSettings` Prisma model with `language`, upsert repository, get/update use cases, `PATCH/GET /users/me/settings` in `libs/users/infrastructure/users.controller.ts`, contract in `libs/users/specs/openapi.yaml`). The web client already has a settings feature with a language preference, an anonymous-only header language switcher, and a boot flow (`resolveInitialLocale`) that fetches settings before mount. The web client styles itself through Tailwind v4 tokens declared statically inside `@theme` in `apps/web/src/styles/globals.css` — light values only, no `dark` variant, no `.dark` palette.

See proposal.md for motivation and the delta specs for the behavioral contract.

## Goals / Non-Goals

**Goals:**

- `theme` becomes a first-class settings field on the users service, defaulting to `system`, with the same identity isolation and partial-update semantics as `language`.
- The web client renders the effective theme from the first paint, with no light flash for users whose cached preference is dark.
- Server value wins for signed-in callers on every load; anonymous visitors keep a local preference with a two-state header toggle.
- Live OS color-scheme tracking while the effective preference is `system`.

**Non-Goals:**

- No theme customization beyond the two palettes (no accent pickers, no per-route themes).
- No cookie-based or server-rendered first paint; the pre-paint resolution is browser-local.
- No migration of an anonymous visitor's local choice into their account on first login (server wins, per agreed behavior).
- No real-time cross-device sync; a stale cache on another device is corrected on the next signed-in load.

## Decisions

### D1. Persistence: add a `theme` column to `UserSettings`

`theme TEXT NOT NULL DEFAULT 'system'` on `user_settings`, mirroring `language`. Domain gets a `SupportedThemeValueObject` beside `SupportedLanguageValueObject`; the entity validates through it; the controller's PATCH schema gains `z.enum(['light','dark','system'])` while staying `.strict()` and partial. Response DTO and `libs/users/specs/openapi.yaml` gain the field.

- *Alternative considered*: client-only persistence (localStorage for everyone). Rejected: the preference would not follow the user across devices and would diverge from the existing settings capability.
- *Alternative considered*: cookie carrying the theme. Rejected: duplicates state in two places (settings + cookie) for a benefit only needed at first paint, which D3 solves locally.

Layer placement stays inside the existing users module: domain VO + entity props, application use case unchanged in shape (it already upserts validated entity props), infrastructure column + controller schema. No new module.

### D2. Reconciliation: server value wins for signed-in callers

On a signed-in load, once the settings response is available, the client applies the stored `theme` and writes it into the local cache. No bootstrap PATCH carries the anonymous choice into the account; settings created by the existing language bootstrap simply default to `system`.

- *Alternative considered*: migrating the anonymous local choice into the first settings write. Rejected in exploration: couples the theme feature to the language bootstrap flow, and the simple one-directional rule ("server wins after login") was agreed with the product decision that anonymous defaults are `system` anyway.

### D3. Anti-FOUC: inline pre-paint script plus a local cache

A tiny dependency-free inline script in `apps/web/index.html` runs before any paint: it reads the cached preference from `localStorage` (single agreed key, e.g. `nx.theme`), validates it against `light|dark|system` (anything else = `system`), and resolves `system` via `matchMedia('(prefers-color-scheme: dark)')`, adding the `dark` class on `<html>` when the result is dark. The app's theme module reuses the exact same storage key and resolution rules, so after boot there is one owner of the state (a `ThemeProvider` + `useTheme` hook in `apps/web/src/shared/theming/`), and the script only exists to make the first paint correct.

Signed-in boot flow: cache paints first; when the settings response arrives, the stored theme overwrites both the applied class and the cache (D2). On failure, the cache stays in effect. While the preference is `system`, the provider subscribes to `matchMedia` change events for live tracking.

- *Alternative considered*: accept a post-boot flash (fetch first, apply later). Rejected: a wrong-theme flash on every load for dark users is clearly worse than a ~10-line inline script.
- *Alternative considered*: a framework library (e.g. next-themes-style package). Rejected: the resolution logic is ~20 lines; a dependency would not remove the duplicated inline script anyway, since it must run before any bundle.

### D4. Palette: restructure `globals.css` to CSS variables with a `.dark` override

Move the current static token values from `@theme` into `:root` custom properties, add a `.dark { ... }` block with the dark palette (shadcn default dark set, adapted to the existing token list including `brand`), and map tokens through `@theme inline` (`--color-background: var(--background)`, etc.). Add `@custom-variant dark (&:where(.dark, .dark *));` so `dark:` utilities follow the class instead of the media query. Existing utility names (`bg-background`, `text-muted-foreground`, ...) keep working unchanged; components keep using semantic tokens, so most components need no edits — a visual audit of pages (landing, auth, dashboard, settings, error) confirms contrast rather than introducing hardcoded colors.

### D5. Web surfaces: anonymous toggle, settings selector

- Header (`app-header.tsx`): a sun/moon icon button shown exactly where `LanguageSwitcher` is shown today (`state !== 'authenticated'`). It toggles between the two explicit states: activating it stores the opposite of the current effective explicit choice (resolving `system` first via the current OS scheme) and applies it. No `system` entry exists for anonymous users (agreed).
- `/settings`: a new section beside "Language" mirroring `LanguagePreference`'s structure, with a three-option control (light/dark/system) rendered for signed-in users. Changes apply immediately, write the cache, and PATCH `PATCH /users/me/settings`; on persistence failure the local choice stays for the session (mirroring how the language switcher already treats persistence failures).
- i18n keys added under the `settings` namespace for `ca`, `es`, `en`.

### D6. Web data layer

`userSettingsSchema` in `apps/web/src/features/settings/api/settings.schema.ts` gains `theme: z.enum(['light','dark','system'])`; the settings hooks stay unchanged in shape since the schema is shared by read and update.

## Risks / Trade-offs

- [Stale cache on a second device shows the wrong theme for one paint] → Accepted trade-off of the local cache; the signed-in load overwrites the cache immediately after the settings response (D2/D3).
- [Inline script duplicates resolution logic outside the bundle] → Keep the script minimal and document the storage key next to the theme module; e2e tests assert the `<html>` class state, making drift observable.
- [Migration adds a NOT NULL column to existing rows] → `DEFAULT 'system'` backfills all rows at migration time; no data rewrite beyond the default.
- [`@theme` restructure could silently break token utilities] → `@theme inline` keeps every existing utility name; `pnpm web:build` and a visual pass over main pages verify nothing regressed.
- [Flash during hydration if React re-renders with a different state than the script applied] → The provider initializes from the same storage key the script used, so both agree before first render; StrictMode double-invocation is idempotent because applying a theme is setting a class, not appending nodes.

## Migration Plan

1. Ship the users service change first: Prisma migration `ALTER TABLE user_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'`, code, contract, and tests. Purely additive; older web bundles that never send or read `theme` keep working (partial PATCH, extra response field).
2. Ship the web client second: palette restructure, theming module, header toggle, settings section.
3. Rollback: revert the web deploy (cache values simply stop being read); revert the API deploy and drop the column if needed — no data is lost that cannot be recreated, since the only persisted value is a three-value enum defaulting to `system`.

## Open Questions

None — remaining choices (exact dark palette values, storage key literal) are task-level details that do not affect specs or approach.
