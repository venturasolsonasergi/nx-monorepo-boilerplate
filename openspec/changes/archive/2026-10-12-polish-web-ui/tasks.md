# Tasks

## 1. Shared language dropdown (`web`)

- [x] 1.1 Create `apps/web/src/shared/layout/language-menu.tsx`: a `DropdownMenu` with a circular `Button` trigger (lucide `Languages`, `aria-label` from `settings:language`) whose content is a `DropdownMenuRadioGroup` bound to `useLanguageChange()`'s `current`/`change`, items being `DropdownMenuRadioItem`s for `SUPPORTED_LOCALES`. Verify with a new `language-menu.test.tsx` that selecting a locale calls `change` and that the active locale item is marked selected (`pnpm web:test`).
- [x] 1.2 Replace the native select in `apps/web/src/shared/layout/language-switcher.tsx` with `LanguageMenu` (or update its call site in `app-header.tsx`) so the header shows the dropdown only when no session is active. Update `language-switcher.test.tsx` from `combobox`/`change` to menu interaction, and update `app-header.test.tsx` (combobox assertions) plus extend its `dropdown-menu` mock with `DropdownMenuRadioGroup`/`DropdownMenuRadioItem`. Verify `pnpm web:test` passes.
- [x] 1.3 Replace the `<select>` in `apps/web/src/features/settings/components/language-preference.tsx` with `LanguageMenu`, keeping the description copy; remove the now-duplicated standalone `Languages` icon if the trigger already conveys it. Verify the settings render test and `pnpm web:test` pass, and that the control opens in dark mode without a white-on-white popup.
- [x] 1.4 Confirm the change persists language for signed-in users and only changes the URL for anonymous users (behavior unchanged, `use-language-change.ts` untouched). Verify by running `pnpm web:test` and `pnpm web:build`.

## 2. Center public content (`web`)

- [x] 2.1 Make `apps/web/src/shared/layout/public-layout.tsx` a full-height column (`flex min-h-svh flex-col`) with the `AppHeader` as its first row and the outlet wrapped in a `flex flex-1 items-center justify-center` container. Verify `pnpm web:test` still passes.
- [x] 2.2 Add `w-full` alongside `max-w-md` on the auth page containers so the forms keep their width inside the new flex row: `login-page.tsx`, `signup-page.tsx`, `complete-signup-page.tsx`, `forgot-password-page.tsx`, `reset-password-page.tsx`, `oauth-callback-page.tsx`. Verify `pnpm web:build` succeeds and forms remain `max-w-md` wide.
- [x] 2.3 Verify the landing page is unaffected (still top-aligned and scrollable) and login/signup are vertically centered on a tall viewport via `pnpm web:e2e`.

## 3. Sidebar simplification (`web`)

- [x] 3.1 Reduce `NAV_ITEMS` in `apps/web/src/features/dashboard/components/dashboard-sidebar.tsx` to the `/dashboard` entry and remove the now-single-item `SidebarGroupLabel`. Update `dashboard-sidebar.test.tsx` to assert only the dashboard link and no `/settings` or `/` navigation entries. Verify `pnpm web:test` passes.
- [x] 3.2 Replace the collapsed brand icon `LayoutDashboard` with lucide `Menu` in `dashboard-sidebar.tsx` so it no longer matches the dashboard entry. Verify the collapsed sidebar renders the `Menu` icon (`pnpm web:test`).
- [x] 3.3 In `common/es.json`, `common/en.json`, and `common/ca.json` together: remove the unused `nav.section`; re-purpose `nav.home` as the brand-link accessible name (`dashboard-sidebar.tsx:36`); add `nav.menuTitle`/`nav.menuDescription` for the mobile side menu's sheet (`sidebar.tsx:150-151`) and `nav.toggleMenu` for the sidebar toggle (`sidebar.tsx:194`). Verify `resources.test.ts` still passes under `pnpm web:test`.
- [x] 3.4 Confirm settings and landing remain reachable from the shell (account control "My profile" and the brand logo) and that the `web/dashboard` shell requirement holds. Verify `pnpm web:build` succeeds.

## 4. Integration checks (`web`)

- [x] 4.1 Run the web test, build, and browser end-to-end suites and confirm they pass: `pnpm web:test`, `pnpm web:build`, `pnpm web:e2e`.
- [x] 4.2 Validate the change artifacts: `openspec validate polish-web-ui --strict`.
