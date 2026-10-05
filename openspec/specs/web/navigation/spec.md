# web/navigation Specification

## Purpose
Define the browser client's route surface and the in-app links that connect its pages, so navigation stays coherent across auth and profile flows.

## Requirements

### Requirement: Serve the application route surface
The web application SHALL resolve each implemented route to its page: the root `/`, the sign-in page `/login`, the sign-up page `/signup`, the password recovery request page `/forgot-password`, the profile page `/users`, the email-verification page `/verified`, the password-reset page `/reset-password`, and the OAuth callback page `/auth/oauth/callback`.

#### Scenario: Known route is opened
- **WHEN** the browser opens one of `/`, `/login`, `/signup`, `/forgot-password`, `/users`, `/verified`, `/reset-password`, or `/auth/oauth/callback`
- **THEN** the page registered for that path is rendered

#### Scenario: Route content loads lazily
- **WHEN** a lazily loaded route is resolving
- **THEN** the layout shows a loading indicator until the page content is ready

### Requirement: Provide in-app links between pages
The verification and OAuth callback pages SHALL each offer a link to continue the flow. The unauthenticated `/users` state SHALL offer a link to `/login`. The sign-in page SHALL offer links to `/signup` and `/forgot-password`.

#### Scenario: Continue after verification or OAuth
- **WHEN** the `/verified` page is shown
- **THEN** it presents a link that navigates to `/login`

#### Scenario: Continue after OAuth
- **WHEN** the `/auth/oauth/callback` page is shown
- **THEN** it presents a link that navigates to `/users`

#### Scenario: Recover from missing session
- **WHEN** the `/users` page is shown without an active session
- **THEN** it presents a link that navigates to `/login`

#### Scenario: Move between auth pages
- **WHEN** the `/login` page is shown
- **THEN** it presents a link to `/signup` and a link to `/forgot-password`

### Requirement: Present a shared, session-aware header
Public pages SHALL render a shared header containing the project name and a user-icon control. The control's menu SHALL reflect the resolved session state: a loading state while the session check is pending; a sign-in action labelled "Acceder" when no session is active; and, when a session is active, a link to "Mi perfil" at `/users`, a non-interactive entry labelled "Dashboard" marked "Próximamente" that does not navigate, and a "Cerrar sesión" action. When the session check fails without a definitive answer, the header SHALL show a recoverable state and SHALL NOT present the caller as signed out. The header SHALL remain usable on both mobile and desktop widths, SHALL be operable by keyboard, and SHALL return focus to the user control when the menu closes.

#### Scenario: Session check is pending
- **WHEN** a public page renders while the session check has not resolved
- **THEN** the header shows a loading state for the user control and does not yet show either menu

#### Scenario: No active session
- **WHEN** the session check reports no active session
- **THEN** the header's user menu offers an "Acceder" action that navigates to `/login`

#### Scenario: Active session
- **WHEN** the session check reports an active session
- **THEN** the header's user menu offers "Mi perfil" linking to `/users`, a "Dashboard" entry marked "Próximamente" that does not navigate, and "Cerrar sesión"

#### Scenario: Session check fails without a definitive answer
- **WHEN** the session check fails with a network error or a non-`401` response
- **THEN** the header shows a recoverable state rather than the signed-out "Acceder" menu

#### Scenario: Header on a narrow viewport
- **WHEN** a public page is viewed on a narrow viewport
- **THEN** the header remains visible and its user control can be opened and used

#### Scenario: Menu is keyboard operable
- **WHEN** a keyboard user opens the user control and moves through the menu
- **THEN** the menu opens, its items are reachable by keyboard, and the active item is indicated

#### Scenario: Escape closes the menu and restores focus
- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes and focus returns to the user control that opened it
