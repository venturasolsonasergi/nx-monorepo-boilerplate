# Design

## Context

See `proposal.md` - Why. This is a `web`-only change: no backend endpoint,
OpenAPI contract, or migration changes. It builds on the archived
`add-web-landing-and-auth-flows` change, whose behavior is now the baseline in
`openspec/specs/web/*` and whose code is in `apps/web`.

Constraints observed in `apps/web` that shape the approach:

- The route tree is flat: every feature route is a child of `rootRoute`, and
  `RootLayout` renders `AppHeader` unconditionally (`app/src/router.tsx`). There
  is no public/workspace layout split yet, so `/users` currently uses the public
  header even though it is an authenticated page.
- `useSessionState()` already exposes `pending | authenticated | unauthenticated
  | unknown`; `useProfile(userId)` uses the shared `profileQueryKey(userId)`;
  `clearPrivateCaches` removes the session and profile caches; `useLogout`
  already calls `POST /auth/logout` and clears private caches, exposing an
  inline recoverable error; `ProfileView` already renders the profile fields.
  `useProfile` is not exported from `features/users/index.ts` yet.
- `useLogin` always navigates to `/users`; `/users` never reads a `returnTo`.
- The shadcn `dropdown-menu` primitive and `components.json` exist; UI wrappers
  under `shared/ui` are hand-written in the shadcn source pattern (no CLI). Only
  `@radix-ui/react-dropdown-menu` and `@radix-ui/react-slot` are installed.
- Tailwind v4 tokens live in `styles/globals.css` via `@theme`, including the
  `--color-brand` accent; the typographic `Wordmark` exists.

## Goals / Non-Goals

**Goals:**

- Add `/dashboard` as a protected route and serve the authenticated workspace
  (`/dashboard` and `/users`) with one sidebar application shell (collapsible
  desktop, accessible mobile menu, compact header, work area), a profile-based
  welcome and read-only summary on `/dashboard`, navigation to the profile and
  the landing, and logout, matching the `web/dashboard` spec.
- Reuse the existing session/profile hooks, query keys, cache clearing, error
  classification, and logout instead of adding a second data source or session
  mechanism.
- Preserve the `/dashboard` destination across login and profile completion with
  a strictly allow-listed `returnTo`.
- Keep the change testable with simulated contracts in Vitest and Playwright.

**Non-Goals:**

- Any `libs/*` or `apps/api` change, any OpenAPI edit, any new backend endpoint.
- A second session mechanism, a second profile query, or any client-side secret
  storage.
- Profile editing, user administration, roles, permissions, statistics, or
  order functionality.
- A new landing or hero; the dashboard reuses the existing visual identity.
- A general redirect framework: only the single exact value `/dashboard` is
  accepted.

## Decisions

### 1. Split the route tree into a public layout and a workspace shell

Move the existing shared header out of `RootLayout` into a pathless public
layout route; attach the landing and auth routes to it. Add a pathless workspace
layout route that renders the sidebar shell, and attach the `/dashboard` and
`/users` routes to it. `RootLayout` keeps only the global providers and the
`Suspense` boundary and renders `<Outlet />`.

- Rationale: the `web/navigation` spec scopes the shared header to the public
  pages; the authenticated workspace needs a consistent chrome, so `/dashboard`
  and `/users` share one shell without stacking two headers or duplicating the
  sidebar per page. The root layout still owns global concerns, so child layouts
  decide visual composition.
- Alternative: hide `AppHeader` with a pathname conditional. Rejected: it
  couples the shared layout to a specific route and was explicitly excluded.
- Alternative: keep `/users` on the public header and give the shell only to
  `/dashboard`. Rejected: it yields inconsistent chrome and duplicates the
  navigation the workspace is meant to share.

### 2. Adapt sidebar-07 minimally

Hand-write, in the existing `shared/ui` pattern, only the primitives the adapted
shell needs: `sidebar` (sidebar-07's core), `sheet` (mobile side menu, built on
`@radix-ui/react-dialog`), and `tooltip` (`@radix-ui/react-tooltip`) for
collapsed controls, plus a local `use-mobile` hook whose breakpoint matches the
CSS. Reuse the existing `dropdown-menu`, `Button`, and icons. A separator uses
CSS unless the adapted component genuinely needs the primitive. Do not copy the
block's fake team switcher, demo navigation, or placeholder content. Do not add
breadcrumb, avatar, or collapsible, and do not add a form library.

- Rationale: the sidebar is the one place true accessibility (focus management,
  Escape, off-canvas) matters; using the canonical primitives avoids
  reimplementing it.
- Alternative: a zero-dependency custom sidebar. Rejected: it would reinvent
  focus and off-canvas behavior and diverge from sidebar-07.

### 3. Share the account menu content, not its container

Extract a shared unit (a hook plus presentational items) that exposes the
resolved session state, the display name, and the actions (`Mi perfil`,
`Cerrar sesión`, retry), reusing `useSessionState`, `useLogout`, and the profile
query. The public header renders it inside its `dropdown-menu`; the dashboard
sidebar footer renders it inside its own footer container with the name and
surname. Neither surface imports the other's container.

- Rationale: keeps one source of menu logic and labels while allowing the
  public and dashboard visuals to differ, per the reviewer's direction.
- Alternative: one dropdown component reused verbatim. Rejected: it would force
  the same visual container in both places.

### 4. Reuse the session and profile queries; add no second source

Gate `/dashboard` with `useSessionState()`. When authenticated, read the profile
with the existing `useProfile(userId)` (keyed by `profileQueryKey(userId)`), and
export `useProfile` from `features/users` for the dashboard to import. Reuse
`clearPrivateCaches` on a `401` profile read and `useLogout` for logout.

- Rationale: the header and dashboard then dedupe into one refresh and one
  profile request, and a user switch cannot read another user's cached profile.
- Alternative: a dashboard-specific profile query. Rejected: a second data
  source and a stale-data risk.

### 5. Gate with component rendering, not a router guard

Resolve gating inside the route component (consistent with `/users`): while the
session is pending, show a workspace loading state; when unauthenticated, render
a redirect to `/login` with the preserved destination; when unknown, show a
recoverable inline state. Do not add a `beforeLoad` guard.

- Rationale: keeps the established pattern and avoids coupling the router to the
  query client; reading the shared query key still performs a single request.
- Alternative: `beforeLoad` with `ensureQueryData`. Deferred: it would avoid a
  brief shell render but introduces router/query coupling for no behavioral gain.

### 6. Allow-listed `returnTo` with a default fallback

Add a small helper that accepts only the exact string `/dashboard`; everything
else (external URLs, `//host`, other internal routes) is discarded. `/dashboard`
redirects to `/login?returnTo=%2Fdashboard` (no session) and to
`/users?returnTo=%2Fdashboard` (no profile). `useLogin` and the `/users` profile
resolution read the validated value and continue to `/dashboard` only when it is
authorized, otherwise to the existing default. The destination never overrides
the session/profile controls on either page.

- Rationale: preserves deep-link continuity without an open-redirect surface.
- Alternative: an arbitrary internal-path validator. Rejected as broader than
  needed; the only preserved destination is `/dashboard`.

### 7. Logout from the dashboard returns to the landing

Reuse `useLogout`; on success navigate to `/`. On failure, show the existing
recoverable logout message and stay signed in.

- Rationale: the dashboard has no anonymous view, so staying would bounce the
  user to `/login` right after they chose to leave; the landing is the natural
  anonymous destination and is already reachable from the public header.
- Alternative: let the dashboard gating redirect to `/login` after logout.
  Rejected as surprising.

### 8. Dashboard main area shows real, fetched content only

The work area shows the welcome (`name` and `surname` from `GET /users/me`), a
read-only summary of name, surname, address, and phone reusing the profile
display, and a link to "Mi perfil". No email (the contracts expose none), no
editing, no metrics, and no placeholder cards.

- Rationale: gives the workspace real substance from data the client already
  holds, without inventing functionality.

### 9. No backend or contract change

Every call is an existing public endpoint (`POST /auth/refresh`,
`POST /auth/login`, `POST /auth/logout`, `GET /users/me`). `libs/auth` and
`libs/users` OpenAPI stay unchanged; `web` has no OpenAPI contract.

## Risks / Trade-offs

- [Splitting the route tree regresses existing routes or the header] → keep
  route factories unchanged and only re-parent them; verify `pnpm web:test`,
  `pnpm web:build`, and `pnpm web:e2e`, including existing smoke and layout
  specs.
- [Adding sidebar primitives disturbs the Tailwind v4 CSS setup] → configure
  against the existing `globals.css` and `@theme` tokens before writing
  components; confirm `pnpm web:build` and `pnpm web:test` still pass.
- [Mobile side menu focus/Escape regressions] → rely on the Radix dialog
  primitive and cover open, Escape, and focus-return in Playwright.
- [Open redirect via `returnTo`] → accept only the exact value `/dashboard`;
  e2e asserts that external, protocol-relative, and other internal values are
  discarded.
- [Redirect loops between `/dashboard`, `/login`, and `/users`] → the preserved
  destination is consumed once at the target; e2e covers the full journey and
  asserts termination.
- [Stale private data after a user switch] → the profile query is keyed by
  `userId`, the session is invalidated on login, and `clearPrivateCaches` runs on
  logout; e2e covers `login A -> dashboard A -> logout -> login B`.
- [Two headers on a workspace page] → reintroducing `AppHeader` in the workspace
  shell; the layout split prevents it, and a Playwright assertion checks a single
  header on `/dashboard` and `/users`.
- [Playwright mocks vs the Vite dev proxy] → `page.route` intercepts `/auth/*`
  and `/users/me` before the proxy; the suite needs no running API.

## Migration Plan

No data migration and no backend deployment; the change ships as static web
assets. Rollback reverts the web change; because the backend contract is
unchanged, a rollback cannot corrupt server state. Existing route paths are
preserved, so bookmarked and emailed links remain valid.

## Open Questions

None blocking. The only conditional dependency is whether the adapted sidebar
needs `@radix-ui/react-separator`; if a decorative line suffices, CSS is used and
the dependency is not added.
