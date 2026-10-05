# Design

## Context

See `proposal.md` - Why. This is a `web`-only change: no backend endpoint is
added or modified, and no OpenAPI contract changes (`libs/auth/specs/openapi.yaml`,
`libs/users/specs/openapi.yaml` stay as-is). All backend calls the new routes make
already exist and are public.

Constraints that shape the approach, observed in `apps/web`:

- `shared/lib/api-client.ts` already sends `credentials: 'include'` and validates
  every response with Zod; it exposes only `get` and `post`. A non-2xx throws
  `ApiError` carrying `status`; a transport failure surfaces as a native fetch
  rejection (not `ApiError`).
- `features/auth/hooks/use-session.ts` wraps `POST /auth/refresh` with
  `retry: false` and currently collapses every failure into "not logged in".
- Features own their routes and export them through their `index.ts`; `app/router.tsx`
  only composes them under the root route. The root layout is the only shared chrome.
- UI primitives under `shared/ui` follow the shadcn source pattern by hand
  (`button`, `card`, `input`, `spinner`) but there is no `components.json`/CLI.
- Tailwind v4 with tokens declared in `styles/globals.css` via `@theme` (oklch),
  which is compatible with shadcn CSS-variable theming.

## Goals / Non-Goals

**Goals:**

- Add the landing, shared header, session-aware menu, login/signup/recovery/logout
  flows, and `/users` retrieval, all as browser-observable behavior matching the
  spec deltas.
- Add the shadcn configuration and the `dropdown-menu` primitive without
  migrating existing components or adding a form library.
- Keep the whole flow testable with simulated contracts (no database, email, or
  live API) in both Vitest and Playwright.

**Non-Goals:**

- Any `libs/*` or `apps/api` change, any OpenAPI edit, any new backend endpoint.
- Profile editing, new profile or signup fields, OAuth provider changes, email
  display, verification resend.
- A full brand system, decorative art, or a sidebar.

## Decisions

### 1. Adopt shadcn/ui minimally: configuration plus the menu primitive

Add `components.json` targeting the existing `@` alias and the Tailwind v4 CSS
entry (`src/styles/globals.css`), and add only the primitive the flow actually
needs: `dropdown-menu` for the session menu. The dropdown also needs the
`--color-popover` and `--color-popover-foreground` theme tokens, added alongside
the existing tokens in `globals.css`. Keep the existing hand-rolled
`button.tsx`, `card.tsx`, and `input.tsx` wrappers unchanged; do **not** migrate
them, do not add a form library (`react-hook-form`, `@hookform/resolvers`, or
shadcn `Form`), and build the new forms with native HTML labels and validation.
A wider shadcn migration is a separate change that needs explicit approval.

- Alternative: full shadcn adoption with canonical primitives and `Form` +
  react-hook-form. Rejected for now to keep the change focused and to preserve
  the existing wrappers, per the reviewer's direction.

### 2. Model session state as four explicit states in one hook

Extend `use-session.ts` to keep the same `POST /auth/refresh` query
(`sessionQueryKey`, `retry: false`) but expose a derived state:
`pending | authenticated | unauthenticated | unknown`.

- `401` (`ApiError.status === 401`) ⇒ `unauthenticated`.
- Any other failure (network, 5xx, schema mismatch) ⇒ `unknown`.
- Add a shared classifier (for example `isUnauthenticatedError`) so the header,
  `/users`, and error surfaces agree.

- Alternative: add a second "who am I" call. Rejected: `refresh` is the
  authoritative session probe and is already the contract.
- Note: because the query key is shared, the header and `/users` dedupe into a
  single refresh request.

On login, the client updates the session cache to the signed-in user and
revalidates it, so the header and `/users` stop reading the pre-login state. The
profile query is keyed by the authenticated `userId` (for example
`['users', 'me', userId]`), so a later user cannot reuse another user's cached
profile.

### 3. Put the header in the root layout, not per public page

Render a new `shared/layout/app-header` in `RootLayout` so it appears on every
route, including `/users`. The menu itself is the stateful element, so gating
stays in one component. The "Dashboard" entry is a non-interactive, disabled
item labelled "Próximamente" (no `<a>`/link role, not focusable as navigation).

- Alternative: render the header only on a subset of routes. Rejected as extra
  composition with no behavioral benefit.

### 4. New feature routes and where files live

- Landing: new `features/landing` (route `/`, landing page, architecture
  overview, wordmark) exported via `createLandingRoutes`.
- Auth: extend `features/auth` with `login-page`, `signup-page`, and
  `forgot-password-page`, registered in `auth.routes.ts`. Update `/verified` to
  continue to `/login` and `/reset-password` for inline error distinction, an
  accessible label, and a login link after success. Keep the
  `/auth/oauth/callback` route and its OAuth contract untouched.
- Users: keep `features/users`; `/users` becomes session-gate → `GET /users/me`
  → profile display, falling back to the existing creation form only on `404`.
- Shared: `shared/ui/*` (shadcn), `shared/layout/app-header`, `shared/lib/*`
  (classifier).

### 5. API layer reuses the existing client and mirrors the OpenAPI shapes

Add Zod-validated calls in `auth.api.ts` for `login`, `signup`, `logout`, and
`requestPasswordReset`, and a `getCurrent` (`GET /users/me`) in the users
feature. Schemas mirror the existing OpenAPI responses; `404` is surfaced as
`ApiError.status === 404`. No `localStorage`; the session travels only in the
HTTP-only cookie via `credentials: 'include'`.

- Alternative: an OpenAPI-generated client. Out of scope; the hand-written
  validated client is the established pattern and `libs/shared/api-contracts`
  is explicitly reserved for future work.

### 6. Logout clears private caches and every active observer

On successful logout, cancel in-flight queries, remove every user's profile
cache entry (`queryClient.removeQueries`), then mark the session as logged out by
writing a `null` sentinel with `queryClient.setQueryData` and revalidating with
`invalidateQueries`. Removing the session entry alone is not enough: an active
observer keeps rendering its last data, so the sentinel is what makes the header
and `/users` move to the anonymous state immediately. Login afterwards starts
from cleared keys keyed by the new `userId`. This prevents a second user on the
same browser from briefly seeing the previous user's profile. The `login A ->
profile A -> logout -> login B` sequence is covered by an explicit test
asserting none of A's data is shown after B signs in. When logout fails without a
definitive answer, the header shows a recoverable message and keeps the caller
signed in.

### 7. Landing architecture as structured HTML/CSS

Render the architecture with semantic HTML (headings, lists) styled by CSS
grid/flex, readable and reflowing at mobile widths, and available to assistive
technology. It shows `apps/web`, `apps/api`, the `auth`/`users`/`orders`
services, and the `infrastructure -> application -> domain` direction, and
separates "code organization" from "runtime: `apps/api` hosts the services".

- Alternative: inline SVG diagram. Not needed; the user preferred HTML/CSS for
  accessibility and reflow, and reserves SVG/logo work.

Real reflow and overlap are verified in Playwright (which computes layout), not
in jsdom/Vitest; the component test only asserts the semantic content.

### 8. Minimal visual identity

Add one brand accent token (for example `--color-brand`) to `@theme` in
`globals.css`, complementary to the existing neutrals, and a typographic
wordmark component. No logo mark, no illustrations.

## Risks / Trade-offs

- [Adding the shadcn `dropdown-menu`/config disturbs the existing hand-rolled
  primitives or the Tailwind v4 setup] → keep `button`/`card`/`input` untouched,
  configure `components.json` for the CSS-based Tailwind v4 setup and `@` alias
  before generating anything, and confirm `pnpm web:build` and `pnpm web:test`
  still pass.
- [Stale private data after a user switch] → key the profile query by `userId`,
  remove session/profile queries on logout, and cover `login A -> logout ->
  login B` with a test.
- [Network failures are native rejections, not `ApiError`, so they can be
  misclassified] → the shared classifier only returns `unauthenticated` for
  `ApiError` with status `401`; everything else is `unknown`.
- [Two components calling `refresh` cause duplicate requests] → shared
  `sessionQueryKey` dedupes; keep `retry: false` so a `401` is not retried.
- [Playwright mocks vs the Vite dev proxy] → `page.route` intercepts before the
  proxy; the e2e suite keeps mocking `/auth/*` and `/users/me` and needs no
  running API. The OAuth e2e verifies the browser return path and that the
  session cookie survives the navigation; it does not authenticate against the
  real backend.
- [A stale dev server could make the e2e suite pass or fail misleadingly] → the
  suite runs its own Vite server on a dedicated port (4300) so it is independent
  of any server already occupying the app's default port. Locally
  `reuseExistingServer` still reuses whatever answers on that port, so a stale
  instance there could give misleading results; CI always starts a fresh one.
- [Logout failure leaves the session active] → surface a recoverable header
  message and keep the caller signed in, rather than clearing local state while
  the server session may still be valid.
- [Landing content drifts from the real repo] → keep it short and sourced from
  `README.md`/`.agents/project-context.md`; no invented numbers.

## Migration Plan

No data migration and no backend deployment. The change ships as static web
assets. Rollback is reverting the web change; because the backend contract is
unchanged, a rollback cannot corrupt server state. Existing routes
(`/verified`, `/reset-password`, `/auth/oauth/callback`, `/users`) keep their
paths, so bookmarked/emailed links remain valid.

## Open Questions

None blocking. The shadcn scope is resolved above: configuration plus
`dropdown-menu` only, existing wrappers untouched, no form library.
