# Spec Delta

## MODIFIED Requirements

### Requirement: Serve the application route surface
The web application SHALL resolve each implemented route to its page: the root `/`, the sign-in page `/login`, the sign-up page `/signup`, the password recovery request page `/forgot-password`, the profile page `/users`, the authenticated dashboard page `/dashboard`, the email-verification page `/verified`, the password-reset page `/reset-password`, and the OAuth callback page `/auth/oauth/callback`.

#### Scenario: Known route is opened
- **WHEN** the browser opens one of `/`, `/login`, `/signup`, `/forgot-password`, `/users`, `/dashboard`, `/verified`, `/reset-password`, or `/auth/oauth/callback`
- **THEN** the page registered for that path is rendered

#### Scenario: Route content loads lazily
- **WHEN** a lazily loaded route is resolving
- **THEN** the layout shows a loading indicator until the page content is ready

### Requirement: Present a shared, session-aware header
The landing and the authentication pages SHALL render a shared header containing the project name and a user-icon control. The authenticated workspace routes (`/dashboard` and `/users`) SHALL render the application shell instead of this header. The control's menu SHALL reflect the resolved session state: a loading state while the session check is pending; a sign-in action labelled "Acceder" when no session is active; and, when a session is active, a link to "Mi perfil" at `/users`, a link to "Dashboard" at `/dashboard`, and a "Cerrar sesión" action. When the session check fails without a definitive answer, the header SHALL show a recoverable state and SHALL NOT present the caller as signed out. The header SHALL remain usable on both mobile and desktop widths, SHALL be operable by keyboard, and SHALL return focus to the user control when the menu closes.

#### Scenario: Session check is pending
- **WHEN** a public page renders while the session check has not resolved
- **THEN** the header shows a loading state for the user control and does not yet show either menu

#### Scenario: No active session
- **WHEN** the session check reports no active session
- **THEN** the header's user menu offers an "Acceder" action that navigates to `/login`

#### Scenario: Active session
- **WHEN** the session check reports an active session
- **THEN** the header's user menu offers "Mi perfil" linking to `/users`, a "Dashboard" entry linking to `/dashboard`, and "Cerrar sesión"

#### Scenario: Dashboard entry navigates
- **WHEN** an authenticated user activates the "Dashboard" entry in the header's user menu
- **THEN** the browser navigates to `/dashboard`

#### Scenario: Session check fails without a definitive answer
- **WHEN** the session check fails with a network error or a non-`401` response
- **THEN** the header shows a recoverable state rather than the signed-out "Acceder" menu

#### Scenario: Header on a narrow viewport
- **WHEN** a public page is viewed on a narrow viewport
- **THEN** the header remains visible and its user control can be opened and used

#### Scenario: Menu is keyboard operable
- **WHEN** a keyboard user opens the user control and moves through the menu
- **THEN** the menu opens, its items are reachable by keyboard, and the active item is indicated

#### Scenario: Workspace routes render the shell, not the public header
- **WHEN** the browser opens `/dashboard` or `/users`
- **THEN** the application shell renders and the shared header does not

#### Scenario: Escape closes the menu and restores focus
- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes and focus returns to the user control that opened it
