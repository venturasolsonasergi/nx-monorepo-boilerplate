# Proposal

## Why

Several small presentation issues make the browser client feel unfinished: the
settings language selector is unreadable in dark mode, the public header's
language control looks out of place beside its icon controls, auth forms cling
to the top on large screens, and the authenticated sidebar carries navigation
and an icon that duplicate each other. This change is a focused polish pass over
the `web` namespace; no backend contract or behavior changes.

## What Changes

- Replace the public header's native language `<select>` with a circular icon
  button (lucide `Languages`) that opens a dropdown, matching the adjacent
  theme and account icon controls. The active locale is marked in the menu.
- Reuse that same dropdown control on the account settings page, replacing the
  native `<select>`. This also fixes the dark-mode bug where the native option
  popup renders white-on-white (Tailwind preflight sets `color: inherit`;
  Chromium's native option list keeps a light background and ignores dark
  theming).
- Center public-page content vertically in `PublicLayout` so login and signup
  (and the other auth pages) are centered when shorter than the viewport,
  instead of clinging to the top.
- Reduce the authenticated workspace sidebar to a single navigation entry
  (`/dashboard`); remove the `/settings` ("My profile") and `/` ("Home") menu
  entries. Access to settings and the landing remains available through the
  shell's account control and its brand logo.
- Replace the collapsed sidebar brand icon (`LayoutDashboard`, identical to the
  dashboard entry) with lucide `Menu`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web/dashboard`: The authenticated application shell requirement changes.
  The shell no longer offers settings and landing as sidebar navigation
  entries; it SHALL offer dashboard navigation from the sidebar and SHALL
  provide account settings and a way back to the landing through its account
  control and brand logo instead.

## Impact

- `apps/web` only. No API, Prisma, or OpenAPI contract changes; the `web`
  namespace has no OpenAPI contract and stays out of service discovery,
  Prisma, contract-test, and OpenAPI validation flows.
- Touched components: shared header language control, settings language
  preference, `PublicLayout` and the auth page containers, the dashboard
  sidebar, and the `nav` copy in the `common` locale resources.
- Tests to update: `language-switcher.test.tsx` (combobox to menu),
  `dashboard-sidebar.test.tsx` (drop the settings and landing link
  assertions), and any header test that asserts the language control.
- Non-goals: no new routes, no changes to language persistence or locale
  resolution, no changes to the theme system, and no backend changes.
