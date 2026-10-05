# Tasks

## 1. shadcn foundation (web)

- [x] 1.1 Add the shadcn/ui setup only: create `components.json` targeting the existing `@` alias and the Tailwind v4 CSS entry (`src/styles/globals.css`) and add the `@radix-ui/react-dropdown-menu` dependency. Do not add a form library (`react-hook-form`, `@hookform/resolvers`) or shadcn `Form`, and do not change `button`/`card`/`input`. Verify `pnpm web:build` succeeds and `pnpm web:test` still passes.
- [x] 1.2 Add only the `dropdown-menu` primitive following the existing `shared/ui` wrapper pattern, leaving `button`, `card`, and `input` unchanged. Verify `pnpm web:test` passes and `pnpm lint` reports no new errors.

## 2. Session state model (web/authentication, web/error-handling)

- [x] 2.1 Extend `useSession` to expose `pending | authenticated | unauthenticated | unknown` and add a shared `isUnauthenticatedError` classifier (`401` only). Verify with unit tests covering `200`, `401`, and a network rejection (`pnpm web:test`).
- [x] 2.2 Add Zod-validated API methods: `login`, `signup`, `logout`, `requestPasswordReset` in `features/auth/api`, and `getCurrentProfile` (`GET /users/me`) in `features/users/api`, mirroring the existing OpenAPI response shapes with no `localStorage`. Verify schema/unit tests pass (`pnpm web:test`).

## 3. Shared header and navigation (web/navigation)

- [x] 3.1 Build `shared/layout/app-header` with the project name and a user-icon control, and render it in the root layout so it appears on every route. Verify a component test renders the header without a session (`pnpm web:test`).
- [x] 3.2 Implement the session-aware menu: loading state; "Acceder" -> `/login` when unauthenticated; "Mi perfil" -> `/users`, a non-interactive "Dashboard" marked "Próximamente", and "Cerrar sesión" when authenticated; a recoverable non-signed-out state when the session is `unknown`. Verify component tests for all four states and that "Dashboard" does not navigate (`pnpm web:test`).
- [x] 3.3 Register `/login`, `/signup`, `/forgot-password`, and `/` (landing) in the router and extend feature route factories, leaving `/verified`, `/reset-password`, and `/auth/oauth/callback` paths unchanged. Verify `pnpm web:build` succeeds and the route components resolve.

## 4. Auth flow pages (web/authentication, web/navigation)

- [x] 4.1 Implement `/login` (email + password -> `POST /auth/login`): success updates and revalidates the session cache so the header and `/users` reflect the signed-in user, clears any prior private data, and continues to `/users`; `401` shows an inline invalid-credentials message; validation/network failures show inline recoverable messages; and the page links to `/signup` and `/forgot-password`. Verify component tests for each case plus that the session query is updated on success (`pnpm web:test`).
- [x] 4.2 Implement `/signup` (email + password -> `POST /auth/signup`): `201` replaces the form with a check-your-email confirmation and creates no session/profile, `409` shows an inline registered-email message, validation/network failures show inline recoverable messages. Verify component tests (`pnpm web:test`).
- [x] 4.3 Implement `/forgot-password` (email -> `POST /auth/reset-password/request`) with a uniform non-disclosing confirmation and an inline recoverable failure state. Verify component tests (`pnpm web:test`).
- [x] 4.4 Adapt `/verified` to offer a link to `/login` and not to claim a session was started, leaving the `/auth/oauth/callback` page and its OAuth contract untouched. Verify component tests for the success and error outcomes (`pnpm web:test`).
- [x] 4.5 Implement the "Cerrar sesión" action: call `POST /auth/logout`, cancel in-flight queries, remove the session and profile cache entries, and update the session state so every active observer renders the anonymous state, showing a recoverable message if logout fails without a definitive answer. Verify a test asserts the caches are cleared and every observer updates, and a full `login A -> profile A -> logout -> login B` test shows none of A's data (`pnpm web:test`).
- [x] 4.6 Adjust `/reset-password` (web/authentication, web/error-handling): distinguish an invalid/expired token (`400`) from a network failure instead of turning every failure into "enlace no válido o caducado", add an accessible label for the password field, and offer a link to `/login` after a successful change. Verify component tests for a missing token, success (with the login link), an invalid token, and a network failure (`pnpm web:test`).

## 5. Users profile retrieval (web/user-management)

- [x] 5.1 Rework `/users` to resolve the session state first (loading / unauthenticated with a `/login` link and no requests / recoverable `unknown`), then call `GET /users/me`: `200` displays name, surname, address, and phone with no creation form, `404` renders the existing creation form, a `401` clears the visible private data, updates the session state, and offers login (never the creation form), and an unknown failure shows a recoverable inline state. Key the profile query by the authenticated `userId`. Verify component tests for each branch (`pnpm web:test`).
- [x] 5.2 Make a successful `POST /users` display the created profile instead of the empty form, keeping the four required fields and existing submission behavior. Verify the component test covers the post-create display (`pnpm web:test`).

## 6. Landing page (web/landing)

- [x] 6.1 Add the brand accent token and a typographic `nx-monorepo-boilerplate` wordmark to the shared styles/components, consistent with the existing tokens and shadcn. Verify `pnpm web:build` succeeds.
- [x] 6.2 Implement the `/` landing with the project name prominent in the first viewport, a brief factual purpose, links to `/login` and `/signup`, and no invented claims or decorative imagery. Verify a component test renders the name, purpose, and both entry actions (`pnpm web:test`).
- [x] 6.3 Implement the architecture overview as accessible, responsive HTML/CSS showing `apps/web`, `apps/api`, the `auth`/`users`/`orders` services, and the `infrastructure -> application -> domain` direction, distinguishing code layout from `apps/api`-hosted runtime. Verify a component test asserts the named elements are present and semantically grouped (jsdom cannot measure reflow); layout reflow is covered by the Playwright task 7.4 (`pnpm web:test`).

## 7. Browser integration (web)

- [x] 7.1 Add Playwright specs driven by mocked `/auth/*` and `/users/me` contracts (no database, email, or live API) covering: landing + anonymous header, login success -> `/users` with the authenticated menu, login `401`, signup -> check-email with the menu still anonymous, `/users` with `GET /users/me` `200`/`404`/refresh `401`, forgot-password confirmation, logout clearing the private cache and returning to "Acceder", and a full `login A -> profile A -> logout -> login B` run showing none of A's data. Verify `pnpm web:e2e` passes.
- [x] 7.2 Add Playwright specs for the failure and return-path cases: a network failure on the session check is not presented as signed out, `/verified?verified=true` continues to `/login`, and `/auth/oauth/callback` continues to `/users` with the session cookie preserved. Verify `pnpm web:e2e` passes.
- [x] 7.3 Update `apps/web-e2e/tests/web-smoke.spec.ts` for the new root landing and the changed unauthenticated `/users` copy/link, removing assertions tied to the old stub. Verify `pnpm web:e2e` passes.
- [x] 7.4 Add Playwright layout checks for the landing and header at mobile and desktop viewports: no horizontal scrolling and no overlapping elements in the architecture overview and header. Verify `pnpm web:e2e` passes.
- [x] 7.5 Add Playwright checks for the session menu keyboard support: open the menu with the keyboard, move through items, close with Escape, and confirm focus returns to the user-icon trigger. Verify `pnpm web:e2e` passes.

## 8. Integration checks (web)

- [x] 8.1 Run the repo-wide `pnpm run verify` and `openspec validate add-web-landing-and-auth-flows`; confirm the web-only change touches no backend architecture/dependency boundary and the change validates.
- [x] 8.2 Run `pnpm web:test`, `pnpm web:build`, and `pnpm web:e2e` together on the final state and confirm all pass.
