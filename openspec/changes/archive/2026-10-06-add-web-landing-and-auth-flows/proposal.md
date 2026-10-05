# Proposal

## Why

The browser client currently has no way to start or end a session: the root route
is a stub, `/users` always renders the profile-creation form, and the existing
`web/authentication` and `web/navigation` specs explicitly forbid a client login
or signup screen. The backend auth and users contracts already expose every
endpoint needed for a full browser access flow, so the gap is entirely in
`apps/web`. Closing it gives the product surface a real landing, a session-aware
header, and an end-to-end email/password and password-recovery flow that reuses
the existing HTTP client and session resolution.

## What Changes

- Add a factual public landing at `/` presenting the project name, its real
  purpose, its real tech stack and structure, and an accessible, responsive
  architecture diagram. No invented marketing content.
- Add a shared, responsive header with a user icon whose menu depends on the
  active session: a loading state, "Acceder" without a session, and
  "Mi perfil", a disabled "Dashboard" ("Próximamente"), and "Cerrar sesión"
  with a session.
- Add `/login` and `/signup` (email + password) against the public
  `POST /auth/login` and `POST /auth/signup` contracts, reusing the shared
  HTTP client with credentials included; sessions stay HTTP-only cookies and
  are never stored in `localStorage`.
- Signup does not create a profile and does not start a session; it shows a
  check-your-email confirmation.
- Adapt `/verified` to continue to `/login` without assuming verification
  starts a session.
- After login, read `GET /users/me`: show the profile when it exists and the
  creation form when the service returns `404`. `/users` no longer always shows
  the creation form.
- Add a password-recovery request page and reuse the existing `/reset-password`
  confirmation flow.
- On logout, revoke the session and clear the private session/profile cache so
  no data from a previous user survives a user switch.
- Treat a session-check failure that is not a `401` (for example a network
  failure) as an unknown state, not as logged out.
- Preserve the existing OAuth routes and behavior without adding providers.
- Add the shadcn/ui configuration and the `dropdown-menu` primitive only, to
  build the header's session menu. Existing wrappers stay unchanged and no
  form library is added.

**BREAKING**: none. Every endpoint used already exists with an unchanged public
contract; no backend or OpenAPI contract is modified.

## Capabilities

### New Capabilities

- `web/landing`: a factual public landing page for the boilerplate, its own
  minimal visual identity, and an accessible architecture overview.

### Modified Capabilities

- `web/navigation`: the route surface is extended with `/login`, `/signup`, and
  a password-recovery request route; a shared responsive header and a
  session-dependent menu are introduced; the restriction that the client has no
  login or verification-request screen is removed.
- `web/authentication`: session resolution distinguishes unauthenticated from
  unknown/failed states; login, signup, password-recovery request, logout with
  private-cache clearing, and the `/verified` continuation to login are added;
  OAuth requirements are preserved.
- `web/user-management`: `/users` reads `GET /users/me` and shows the existing
  profile instead of always presenting the creation form, with distinct
  unauthenticated and failed-session states.
- `web/error-handling`: failed and invalid states, including a failed session
  check and network failures, are surfaced inline and recoverably, and a failed
  session check is never presented as logged out.

## Impact

- `apps/web`: routes and feature code under `features/auth`, `features/users`,
  a new landing feature, shared UI primitives, and the root layout/header.
- `apps/web` tooling: shadcn/ui configuration and the `dropdown-menu` primitive
  only; one new Radix dependency, no form library.
- Tests: Vitest component tests and Playwright browser e2e with simulated
  backend contracts (no database, email, or live API).
- Backend: **none**. `POST /auth/signup`, `POST /auth/login`,
  `POST /auth/logout`, `POST /auth/refresh`,
  `POST /auth/reset-password/request`, `POST /auth/reset-password/confirm`, and
  `GET /users/me` already exist and keep their public shape. `libs/auth` and
  `libs/users` OpenAPI contracts are unchanged.
- Recorded limitations: no public resend-verification endpoint exists, so
  `/verified` offers no resend action; the session and profile contracts expose
  no email, so the menu and profile show no email.
