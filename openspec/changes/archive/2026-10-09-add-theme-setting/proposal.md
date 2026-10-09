# Proposal

## Why

The web client only offers a light theme, and users cannot choose how the interface looks. The platform already stores per-user preferences (`users/user-settings`, currently `language` only); adding a theme preference there completes the settings surface with a preference users expect, while the default keeps following the operating system until the user decides otherwise.

## What Changes

- Add a `theme` preference to the users settings API: `GET /users/me/settings` and `PATCH /users/me/settings` expose `theme` with values `light`, `dark`, `system`, defaulting to `system` for newly created settings.
- Introduce a dark color palette for the web client and class-based dark mode styling, applied by toggling a `dark` class on the document root.
- Apply the theme on the web client before first paint using a cached value in `localStorage`, so an authenticated user with a stored dark theme sees no light flash while the app boots.
- Resolution rules (agreed in exploration):
  - Signed-in users: the server settings value is authoritative and overwrites the local cache on load; theme changes from `/settings` write to the server and update the cache.
  - Anonymous visitors: `system` resolution by default; a sun/moon toggle next to the header language switcher offers only light/dark; the choice is kept in `localStorage` only and has no path back to `system` without signing in.
  - On logout the cached theme is kept and remains in effect.
  - While the preference is `system`, the client follows live changes of the OS preference.
- The header theme toggle is anonymous-only; signed-in users change the theme exclusively from `/settings` (mirroring the existing language behavior).

## Capabilities

### New Capabilities

- `web/theming`: browser-observable theme behavior — initial theme resolution before first paint, the anonymous header toggle, the `/settings` theme selector for signed-in users, `system` tracking, and cache/server precedence.

### Modified Capabilities

- `users/user-settings`: the settings payload gains a `theme` field (`light` | `dark` | `system`), validated server-side, persisted with the same identity isolation as `language`, and defaulting to `system` on creation.

## Impact

- **users service** (`libs/users`): Prisma `UserSettings` model and migration (new `theme` column), domain entity and value object, update use case, controller request schema, `libs/users/specs/openapi.yaml` contract, unit and contract tests.
- **web client** (`apps/web`): `globals.css` palette restructure (`:root`/`.dark` custom properties with `@theme inline` and a `dark` custom variant), a theme module in `shared/` (inline pre-paint script, storage helpers, React context/hook), header toggle component, `/settings` theme section, i18n strings for `ca`/`es`/`en`, unit and e2e tests.
- **Compatibility**: the settings response and PATCH bodies gain an optional-to-read, required-in-contract `theme` field; existing clients that only send `language` keep working because PATCH remains a partial update. No stored data is migrated — existing rows read as `system` by the API default column value.
- **Non-goals**: per-component or per-route theme overrides; a themed landing/marketing variant beyond the shared palette; server-side rendering of theme; a way for anonymous users to restore `system` once they pick light/dark; syncing theme across devices in real time (correction happens on next signed-in load).
