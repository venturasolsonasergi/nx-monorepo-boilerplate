# web/dashboard Specification

## Purpose

Present a protected workspace for the signed-in user: an application shell
shared by the authenticated workspace routes (`/dashboard` and `/settings`), a
welcome and read-only profile summary on the dashboard derived from the caller's
own profile, navigation between the dashboard, the profile, and the landing, and
the session/profile gating states for the route.

## Requirements

### Requirement: Gate the dashboard behind an active session

The `/dashboard` route SHALL resolve the session before rendering its content.
While the session check is pending it SHALL show a loading state for the
workspace and SHALL NOT request `GET /users/me`. When the session check reports
no active session it SHALL continue to `/login` while preserving `/dashboard` as
the post-login destination, and SHALL NOT request `GET /users/me`. When the
session check fails without a definitive answer it SHALL show a recoverable
inline state, SHALL NOT treat the caller as signed out, and SHALL NOT request
`GET /users/me`.

#### Scenario: Session check is pending
- **WHEN** the `/dashboard` route mounts and the session check has not resolved
- **THEN** the route shows a loading workspace and sends no `GET /users/me`

#### Scenario: No active session
- **WHEN** the session check reports no active session
- **THEN** the route continues to `/login` with `/dashboard` preserved as the post-login destination and sends no `GET /users/me`

#### Scenario: Session check fails without a definitive answer
- **WHEN** the session check fails with a network error or a non-`401` response
- **THEN** the route shows a recoverable inline state, does not present the caller as signed out, and sends no `GET /users/me`

#### Scenario: Active session
- **WHEN** the session check reports an active session
- **THEN** the route proceeds to load the authenticated caller's profile

### Requirement: Present the signed-in user's welcome and profile summary

When a session is active, the `/dashboard` route SHALL request `GET /users/me`.
When the service returns `200` the route SHALL greet the user with the returned
profile's name and surname and SHALL display a read-only summary of the
profile's name, surname, address, and phone values. It SHALL NOT display an
email address and SHALL NOT offer profile editing. When the service returns
`404` the route SHALL continue to `/settings` while preserving `/dashboard` as
the return destination. When the service returns `401` (for example a session
that expires between the session check and the profile read) the route SHALL
clear any visible private data, update the session state to unauthenticated, and
continue to `/login` while preserving `/dashboard`. When the request fails
without a definitive answer the route SHALL show a recoverable inline state and
SHALL NOT present the profile summary or the creation form.

#### Scenario: Profile exists
- **WHEN** `GET /users/me` returns `200`
- **THEN** the route greets the user with the profile's name and surname and shows a read-only summary of name, surname, address, and phone, without an email and without profile editing

#### Scenario: Profile does not exist
- **WHEN** `GET /users/me` returns `404`
- **THEN** the route continues to `/settings` with `/dashboard` preserved as the return destination

#### Scenario: Session expires before the profile read
- **WHEN** `GET /users/me` returns `401`
- **THEN** the route clears any visible private data, updates the session state, and continues to `/login` with `/dashboard` preserved

#### Scenario: Profile retrieval fails without a definitive answer
- **WHEN** `GET /users/me` fails with a network error or a non-`401`, non-`404` response
- **THEN** the route shows a recoverable inline state and does not present the profile summary or the creation form

#### Scenario: A later user does not inherit the previous user's data
- **WHEN** a user signs out and a different user signs in on the same browser and opens `/dashboard`
- **THEN** the route greets the new user and shows only the new user's profile, with none of the previous user's data

### Requirement: Provide the authenticated application shell

The authenticated workspace routes (`/dashboard` and `/settings`) SHALL render
inside a shared application shell containing a sidebar that is collapsible on
desktop, an accessible off-canvas side menu on mobile, a compact header, and a
main work area. The shell SHALL offer navigation to the dashboard, a link to the
account settings at `/settings`, and a way back to the landing at `/`. The shell
SHALL show only implemented
destinations and account actions and SHALL NOT present placeholder links,
invented metrics, demo navigation, or business screens added to fill space. The
shell SHALL be operable by keyboard, SHALL close the mobile side menu when the
user presses Escape, and SHALL return focus to the control that opened it.

#### Scenario: Desktop sidebar is collapsible
- **WHEN** the dashboard is viewed on a desktop viewport
- **THEN** the sidebar can be collapsed and expanded and its destinations remain reachable

#### Scenario: Mobile side menu is accessible
- **WHEN** the dashboard is viewed on a narrow viewport
- **THEN** the side menu is opened from a control, its destinations are reachable, Escape closes it, and focus returns to the control that opened it

#### Scenario: The shell is shared by the authenticated routes
- **WHEN** the browser opens `/dashboard` or `/settings`
- **THEN** the same application shell renders (sidebar, compact header, and account control) and the public header does not render

#### Scenario: Navigation between implemented destinations
- **WHEN** the user activates the dashboard, the account settings, or the landing link in the shell
- **THEN** the browser navigates to `/dashboard`, `/settings`, or `/` respectively, within the active locale

#### Scenario: Language switcher is not in the shell
- **WHEN** the workspace shell renders
- **THEN** no language switcher is presented in the shell

#### Scenario: No placeholder or invented content
- **WHEN** the dashboard shell is rendered
- **THEN** it shows no disabled or dead navigation entries, no invented metrics, and no demo or business content beyond the implemented destinations

### Requirement: End the browser session from the workspace shell

The workspace shell's "Cerrar sesión" action SHALL reuse the established logout
behavior: it SHALL call `POST /auth/logout` with credentials included, SHALL
clear the cached session and profile data so that a subsequent user cannot see
the previous session's private data, and, on success, SHALL continue to the
landing at `/`. When logout fails without a definitive answer, the shell SHALL
show a recoverable message and SHALL NOT present the caller as signed out while
the session may still be active.

#### Scenario: Successful logout
- **WHEN** an authenticated user activates "Cerrar sesión" in the workspace shell and `POST /auth/logout` succeeds
- **THEN** the session and profile caches are cleared and the browser continues to `/`

#### Scenario: Logout fails without a definitive answer
- **WHEN** `POST /auth/logout` fails with a network error
- **THEN** the shell shows a recoverable message and does not present the caller as signed out
