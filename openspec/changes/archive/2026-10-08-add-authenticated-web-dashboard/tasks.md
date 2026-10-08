# Tasks

## 1. Prerequisite gate

- [x] 1.1 Confirm the dependency `add-web-landing-and-auth-flows` is implemented and archived and that its specs are merged (`web/landing` present; `web/navigation`, `web/authentication`, and `web/user-management` updated). Do not modify that change. Verify with `openspec list --specs` and `openspec validate --archived`.

## 2. Dashboard shell foundation (web, shared/ui)

- [x] 2.1 Add only the needed sidebar dependencies — `@radix-ui/react-dialog` (mobile sheet) and `@radix-ui/react-tooltip` (collapsed labels); add `@radix-ui/react-separator` only if the adapted component needs the primitive, otherwise use CSS for a decorative line — plus a local `use-mobile` hook whose breakpoint is aligned with the CSS. Do not add a form library and do not change the existing `button`/`card`/`input`. Verify `pnpm web:build` succeeds and `pnpm web:test` still passes.
- [x] 2.2 Hand-write `shared/ui/sidebar.tsx`, `shared/ui/sheet.tsx`, and `shared/ui/tooltip.tsx` following the existing `shared/ui` pattern; the mobile sheet manages focus, closes with Escape, and exposes an accessible title, and collapsed controls are labeled. Verify component tests and that `pnpm lint` reports no new errors.
- [x] 2.3 Split the route tree: move `AppHeader` into a pathless public layout route and add a pathless dashboard layout route; `RootLayout` keeps the global providers and the `Suspense` boundary and renders `Outlet`, with no pathname conditionals. Verify existing routes and the header still render and that `pnpm web:test` and `pnpm web:build` pass.

## 3. Shared account menu and header entry (web/navigation)

- [x] 3.1 Extract the account-menu content (resolved session state, display name, "Mi perfil", "Cerrar sesión", retry) into a shared unit that reuses `useSessionState`, `useLogout`, and the profile query, and render it in `AppHeader` inside its dropdown container. Verify the header component tests pass and `pnpm web:test` succeeds.
- [x] 3.2 Enable the header's "Dashboard" entry as a link to `/dashboard`, removing the disabled "Próximamente" placeholder. Verify a component test asserts the entry navigates to `/dashboard` (`pnpm web:test`).

## 4. Allow-listed returnTo (web/authentication, web/user-management)

- [x] 4.1 Add the `returnTo` helper that accepts only the exact value `/dashboard` and discards external URLs, protocol-relative hosts, and other internal routes. Verify unit tests for accepted and rejected values (`pnpm web:test`).
- [x] 4.2 Honor the authorized `returnTo` in login (`/login`) and in the `/users` profile resolution for both an existing (`200`) and a created (`201`) profile, defaulting to `/users` otherwise, without modifying the prerequisite change. Verify component tests for authorized, unauthorized, and absent destinations (`pnpm web:test`).

## 5. Dashboard feature (web/dashboard)

- [x] 5.1 Export `useProfile` from `features/users` and reuse it from the dashboard instead of adding a second profile query. Verify `pnpm web:test` and that the dashboard and `/users` share the same profile query key.
- [x] 5.2 Implement the `/dashboard` route gating with the session state: a pending workspace loading state; on no session continue to `/login` with `/dashboard` preserved and send no `GET /users/me`; on an unknown state show a recoverable inline state without requesting the profile. Verify component tests for each state (`pnpm web:test`).
- [x] 5.3 With an active session, resolve `GET /users/me`: `200` renders the welcome (name and surname) and a read-only summary of name, surname, address, and phone with no email and no editing; `404` continues to `/users` with `/dashboard` preserved; `401` clears private caches and continues to `/login` with `/dashboard` preserved; any other failure shows a recoverable inline state. Verify component tests for each branch (`pnpm web:test`).
- [x] 5.4 Build the dashboard application shell adapted from `sidebar-07`: a collapsible desktop sidebar, an accessible mobile side menu, a compact header, and a work area; the sidebar footer carries the account control (name and surname, "Mi perfil", "Cerrar sesión") and stays reachable in the mobile menu; provide links to the dashboard, `/users`, and `/`. Show only implemented destinations with no demo navigation, invented metrics, or placeholder content. Verify component tests for navigation and `pnpm web:test`.
- [x] 5.5 Implement logout from the dashboard: reuse `useLogout` (clear the session and profile caches), continue to `/` on success, show a recoverable message on failure, and never show the previous user's data. Verify a `login A -> dashboard A -> logout -> login B` component test shows none of A's data (`pnpm web:test`).

## 6. Browser integration (web)

- [x] 6.1 Add Playwright specs driven by mocked `/auth/*` and `/users/me` contracts (recorded as simulated contracts, not live integration) covering direct visit and reload of `/dashboard`, login continuation, profile absent -> `/users`, profile expiry, user switch, logout, and that exactly one header renders. Verify `pnpm web:e2e` passes.
- [x] 6.2 Add Playwright specs for `returnTo`: the authorized value continues to `/dashboard`; manipulated values (external URL, `//host`, other internal route) are discarded to `/users`; the full journey terminates with no redirect loop. Verify `pnpm web:e2e` passes.
- [x] 6.3 Add Playwright layout and interaction checks for the dashboard shell at desktop and mobile viewports: collapsible sidebar, mobile menu, keyboard operation, Escape with focus return, no overlapping elements, and no horizontal scrolling. Verify `pnpm web:e2e` passes.
- [x] 6.4 Update the existing web-e2e specs affected by the layout split and the enabled "Dashboard" entry (`web-smoke`, `auth-flows`, `header-keyboard`), removing assertions tied to the disabled placeholder. Verify `pnpm web:e2e` passes.

## 9. Workspace shell for authenticated pages

- [x] 9.1 Rename the dashboard layout route to a workspace layout, move the `/users` route under it, and update `router.tsx` so `/dashboard` and `/users` render the shell and no longer the public header. Verify `pnpm web:build` succeeds and `pnpm web:test` still passes.
- [x] 9.2 Ensure the workspace shell renders on `/users` correctly: the sidebar, compact header, and account footer are visible; the users content (profile or creation form) renders inside the work area. Verify with a Playwright layout spec for `/users` inside the shell and `pnpm web:e2e`.
- [x] 9.3 Update existing e2e specs (`auth-flows`, `failure-and-return`) that operated on `/users` using the public header's dropdown menu: redirect them to use the shell's account footer ("Mi perfil", "Cerrar sesión"). Verify `pnpm web:e2e` passes.
- [x] 9.4 Update the `web-smoke` spec so the "with a session but no profile the creation form is shown" test also asserts the workspace shell (sidebar present, public header absent) on `/users`. Verify `pnpm web:e2e` passes.
- [x] 9.5 Run `pnpm lint`, `pnpm web:test`, `pnpm web:build`, `pnpm web:e2e`, and `openspec validate add-authenticated-web-dashboard` and confirm all pass.
