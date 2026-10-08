# Proposal

## Why

After `add-web-landing-and-auth-flows`, an authenticated user can sign in, see
their profile at `/users`, and sign out, but the shared header still offers only
a disabled "Dashboard" entry. The product has no authenticated workspace: there
is no protected `/dashboard` route, no application shell to navigate between the
dashboard, the profile, and the landing, and the profile data the client already
fetches (`GET /users/me`) is used only on `/users`. This change adds that
workspace as a browser-observable capability, reusing the session and profile
contracts the previous change established. The authenticated area is served by a
single shared sidebar shell: `/dashboard` and `/users` (and future authenticated
pages) use the same application shell instead of the public header, so the
workspace chrome is consistent and not duplicated per page.

## What Changes

- Add a protected `/dashboard` route. It resolves the session first, then the
  authenticated caller's profile (`GET /users/me`).
- Add a dashboard application shell adapted from the shadcn `sidebar-07` block:
  a collapsible sidebar on desktop, an accessible off-canvas menu on mobile, a
  compact header, and a main work area. Only real destinations are shown; no
  demo navigation, no team/company switcher, no invented widgets or metrics.
- Serve the authenticated area with that shared shell: `/dashboard` and
  `/users` render inside the same application shell, so both share the sidebar,
  its navigation, and the account control. `/users` stops rendering the public
  header; the shell replaces it. Public pages (the landing and the
  authentication pages) keep the shared header.
- Welcome the user with their `name` and `surname` from `GET /users/me`, plus a
  read-only summary of their profile fields and a link to "Mi perfil". No email
  is shown (the contracts expose none) and no invented profile data is used.
- Put the account control (name and surname, "Mi perfil", "Cerrar sesión") in
  the dashboard sidebar footer, and keep it reachable on mobile inside the
  side menu. The public header keeps its own container. Both surfaces share the
  same menu content and session/profile logic without duplicating it.
- Activate the shared header's "Dashboard" entry: it becomes a link to
  `/dashboard` instead of the disabled "Próximamente" placeholder.
- Preserve the `/dashboard` destination across the sign-in and profile
  completion steps: without a session, `/dashboard` continues to
  `/login?returnTo=%2Fdashboard`; without a profile it continues to
  `/users?returnTo=%2Fdashboard`; after a successful login or once the profile
  exists or is created, the client continues to `/dashboard`. Only the exact
  value `/dashboard` is accepted; any other value is discarded and the default
  behavior (continue to `/users`) is used. External URLs, protocol-relative
  hosts, and arbitrary internal routes are never accepted.
- Reuse the existing logout behavior and private-cache clearing. After a
  successful logout from the dashboard, continue to `/` (the landing).
- Split the route composition into a public layout (the existing shared header
  for the landing and authentication pages) and a workspace layout (the sidebar
  shell for `/dashboard` and `/users`), so those pages do not render the public
  header. The root layout keeps the global providers and shared elements; child
  layouts decide the visual composition. No pathname conditionals hide the
  header.

**BREAKING**: none. No backend endpoint, OpenAPI contract, or existing browser
route changes its public behavior. The added `returnTo` is optional and
allow-listed; without it, login and profile behavior is unchanged.

## Capabilities

### New Capabilities

- `web/dashboard`: a protected authenticated workspace with a sidebar shell, a
  profile-based welcome, navigation between the dashboard, the profile, and the
  landing, and the session/profile gating states for the route.

### Modified Capabilities

- `web/navigation`: the route surface adds `/dashboard`; the shared,
  session-aware header is scoped to the public pages (landing and
  authentication), its "Dashboard" entry becomes an in-app link instead of a
  disabled placeholder, and the authenticated workspace routes render the
  application shell rather than the header.
- `web/authentication`: a successful login continues to an authorized
  `returnTo` destination when present, and to `/users` otherwise.
- `web/user-management`: the `/users` page renders inside the workspace shell,
  and after the caller's profile is confirmed to exist or is created, `/users`
  continues to an authorized `returnTo` destination when present, and keeps its
  current behavior otherwise.

## Impact

- `apps/web`: a new `features/dashboard` (routes, shell, page), a shared layout
  split in `app/router.tsx` (public layout vs workspace shell), a shared
  account-menu unit reused by the header and the sidebar footer, a couple of
  shadcn-style primitives under `shared/ui` (sidebar, sheet, tooltip), a
  `use-mobile` hook, and a small `returnTo` validation helper. `features/users`
  moves under the workspace shell, gains a public export of its profile hook,
  and reads an optional `returnTo`; `features/auth` reads and honors it on
  login.
- `apps/web` dependencies: add `@radix-ui/react-dialog` (mobile sheet) and
  `@radix-ui/react-tooltip` (collapsed sidebar labels). A separator primitive is
  added only if the adapted component needs it; a decorative line uses CSS. No
  form library is added and the existing `button`/`card`/`input` wrappers are
  unchanged.
- Tests: Vitest component tests and Playwright browser e2e driven by simulated
  `/auth/*` and `/users/me` contracts (no database, email, or live API).
- Backend: **none**. `POST /auth/login`, `POST /auth/logout`,
  `POST /auth/refresh`, and `GET /users/me` already exist and keep their public
  shape. `libs/auth` and `libs/users` OpenAPI contracts are unchanged.

### Dependencies

- Depends on `add-web-landing-and-auth-flows`, which is implemented, verified,
  and archived. This change starts only after that change's specs are merged
  (they are), because its `web/navigation`, `web/authentication`, and
  `web/user-management` deltas modify requirements that change introduced.
- OpenSpec change metadata has no dependency field; this dependency is recorded
  here and enforced as the first gate in `tasks.md`.
- Recorded limitations: the session and profile contracts expose no email, so
  the dashboard and sidebar show no email; the dashboard adds no business
  functionality beyond the caller's own profile.
