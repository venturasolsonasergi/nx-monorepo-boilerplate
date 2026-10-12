# Design

## Context

See `proposal.md` - Why. All work is inside the `web` namespace
(`apps/web`); no backend contract is modified and the `web` namespace has no
OpenAPI contract. Relevant current state:

- `shared/layout/language-switcher.tsx` renders a bare native `<select>` for the
  public header, shown only to anonymous visitors (`app-header.tsx:30`).
- `features/settings/components/language-preference.tsx` renders a second native
  `<select>` beside a lucide `Languages` icon.
- `shared/layout/public-layout.tsx` renders `AppHeader` plus `Outlet` with no
  vertical layout; each auth page is `mx-auto max-w-md ... p-6` (login, signup,
  forgot-password, reset-password, complete-signup, oauth-callback).
- `features/dashboard/components/dashboard-sidebar.tsx` lists three `NAV_ITEMS`
  (`/dashboard`, `/settings`, `/`) and renders a `LayoutDashboard` icon for the
  collapsed brand link.
- `shared/ui/dropdown-menu.tsx` already provides Radix primitives including
  `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` (with a check indicator).
- `shared/i18n/resources.test.ts` enforces identical keys across `es`, `en`,
  and `ca` for every namespace.

## Goals / Non-Goals

**Goals:**

- One language control component shared by the public header and the settings
  page, fully themable in dark mode, with the active locale visibly marked.
- Vertically centered public-page content without breaking the tall landing
  page or the horizontal `max-w-md` form width.
- A sidebar whose navigation matches the reduced destination set, while settings
  and landing stay reachable through the shell's existing account control and
  brand logo.

**Non-Goals:**

- No change to locale resolution, persistence, or the `PATCH /users/me/settings`
  call; `use-language-change.ts` is reused unchanged.
- No change to the theme system or `ThemeToggle`.
- No new routes, headers, or backend behavior.

## Decisions

### D1: Replace both native selects with one shared `LanguageMenu` dropdown

Create `shared/layout/language-menu.tsx`: a `DropdownMenu` whose trigger is a
circular `Button` (`rounded-full`, lucide `Languages`), whose content is a
`DropdownMenuRadioGroup` bound to the current locale, and whose items are
`DropdownMenuRadioItem`s (the radio indicator renders the active-locale check).
It calls `useLanguageChange()` exactly as the current switcher does.

- Rationale: fixes the dark-mode popup (Radix renders real DOM, unlike the
  native option list, which Chromium keeps light and Safari cannot style) and
  matches the adjacent icon controls in `app-header.tsx`. One component removes
  the duplicated select markup.
- Alternatives considered: (a) keep a native `<select>` and add
  `bg-background text-foreground` plus `[&>option]:bg-background
  [&>option]:text-foreground`. Rejected: `option` styling is best-effort and
  ignored by Safari/macOS, so the bug can survive. (b) Two separate custom
  dropdowns. Rejected: duplication.
- `language-switcher.tsx` becomes a thin re-export/wrapper around `LanguageMenu`
  (or is replaced at its call site) so `app-header.tsx` keeps hiding it for
  authenticated sessions. Accessibility: the trigger carries
  `aria-label={t('settings:language')}`; the radio group exposes the selected
  locale; keyboard operation comes from Radix.

### D2: Settings page reuses `LanguageMenu`

`language-preference.tsx` keeps its description copy and the `Languages` icon in
its current placement but replaces the `<select>` with `LanguageMenu`, or drops
the separate icon since the trigger already shows it. Preferred: replace the
whole row with `LanguageMenu` and keep the description text above it.

### D3: Center public content in `PublicLayout`

Turn `PublicLayout` into a full-height column and center the outlet area:

```
<div class="flex min-h-svh flex-col">
  <AppHeader/>
  <div class="flex flex-1 items-center justify-center"><Outlet/></div>
</div>
```

- Small pages center vertically; the landing page is taller than the viewport,
  so the container grows and there is no free space to center, leaving it
  top-aligned.
- Rationale: one change covers login and signup and every other public page.
  Alternative considered: per-page `min-h-[calc(100svh-...)] justify-center`.
  Rejected: implicit header height, fragile, repeated across six files.

### D4: Sidebar keeps only `/dashboard`; localize the shell's remaining labels

Reduce `NAV_ITEMS` to the dashboard entry and remove `SidebarGroupLabel`
("Navigation") now that a single item remains. Settings and landing remain
reachable through `AccountFooter`'s "My profile" link and the sidebar header
brand logo (`dashboard-sidebar.tsx:36`), so the shell capability in
`web/dashboard` is preserved. In the `common` locale resources, change all three
files (`es`, `en`, `ca`) together to satisfy the resource parity test: drop the
now-unused `nav.section` key; re-purpose `nav.home` as the brand-link accessible
name (`dashboard-sidebar.tsx:36`); and add `nav.menuTitle`/`nav.menuDescription`
(the mobile side menu's sheet title and description, `sidebar.tsx:150-151`) and
`nav.toggleMenu` (the sidebar toggle's label, `sidebar.tsx:194`). Keep
`nav.dashboard` and `nav.profile` (the latter still labels the settings
workspace title in `settings.routes.ts:16`).

### D5: Collapsed brand icon becomes lucide `Menu`

Replace `LayoutDashboard` in the collapsed sidebar header with lucide `Menu`, so
the brand link no longer duplicates the dashboard entry's icon.

## Risks / Trade-offs

- [Flex item shrink] Moving the auth `<main>` into a flex row makes it size to
  content, collapsing the `max-w-md` form width -> add `w-full` to each auth
  `<main>` alongside `max-w-md` and keep `mx-auto`.
- [Menu semantics] A `menu`/`menuitemradio` pattern is used for a single-choice
  control rather than a native listbox -> acceptable for three locales; the
  trigger is labelled and the active item is indicated. Native mobile picker is
  lost, mitigated by a short three-item menu.
- [Reduced discoverability] Removing the settings and landing sidebar entries ->
  settings stays one click away in the always-visible account footer, and the
  brand logo remains a link to `/`.
- [Test drift] `language-switcher.test.tsx`, `app-header.test.tsx`, and
  `dashboard-sidebar.test.tsx` assert the old `combobox`/link behavior and must
  be updated; `app-header.test.tsx` also mocks `dropdown-menu` without the radio
  primitives, so the mock needs extending.
- [Locale resource parity] Removing `nav.section` and adding the re-purposed
  `nav.home` plus `nav.menuTitle`/`nav.menuDescription`/`nav.toggleMenu` breaks
  the parity test unless all three locales change together.

## Migration Plan

Pure client-side presentation change; no data or contract migration. Deploy by
shipping the rebuilt `apps/web` bundle. Rollback is reverting the `apps/web`
changes; no persisted state is affected.

## Open Questions

None that affect the specs, approach, or task breakdown.
