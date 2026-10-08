# Spec Delta

## MODIFIED Requirements

### Requirement: Serve the application route surface
The web application SHALL resolve each implemented route to its page within a locale prefix from `es`, `en`, and `ca` (for example `/es/dashboard`): the root `/`, the sign-in page `/login`, the sign-up page `/signup`, the password recovery request page `/forgot-password`, the account settings page `/settings`, the authenticated dashboard page `/dashboard`, the email-verification page `/verified`, the password-reset page `/reset-password`, and the OAuth callback page `/auth/oauth/callback`. A request to an implemented route without a locale prefix SHALL continue to the same route under a chosen locale prefix.

#### Scenario: Known route is opened
- **WHEN** the browser opens one of `/`, `/login`, `/signup`, `/forgot-password`, `/settings`, `/dashboard`, `/verified`, `/reset-password`, or `/auth/oauth/callback` under a supported locale prefix
- **THEN** the page registered for that path is rendered

#### Scenario: Route content loads lazily
- **WHEN** a lazily loaded route is resolving
- **THEN** the layout shows a loading indicator until the page content is ready

#### Scenario: Prefix-less request continues to a locale
- **WHEN** the browser opens an implemented route without a locale prefix
- **THEN** it is continued to the same route under a chosen locale prefix

#### Scenario: Unsupported locale prefix
- **WHEN** the browser opens an implemented route under a locale prefix outside `es`, `en`, and `ca`
- **THEN** it is continued to the same route under a supported locale prefix

### Requirement: Provide in-app links between pages
The verification and OAuth callback pages SHALL each offer a link that continues the flow within the active locale. The unauthenticated account settings state SHALL offer a link to `/login`. The sign-in page SHALL offer links to `/signup` and `/forgot-password`.

#### Scenario: Continue after verification or OAuth
- **WHEN** the `/verified` page is shown
- **THEN** it presents a link that navigates to `/login`

#### Scenario: Continue after OAuth
- **WHEN** the `/auth/oauth/callback` page is shown
- **THEN** it presents a link that navigates to the account settings page

#### Scenario: Recover from missing session
- **WHEN** the account settings page is shown without an active session
- **THEN** it presents a link that navigates to `/login`

#### Scenario: Move between auth pages
- **WHEN** the `/login` page is shown
- **THEN** it presents a link to `/signup` and a link to `/forgot-password`

### Requirement: Present a shared, session-aware header
The landing and the authentication pages SHALL render a shared header containing the project name, a language switcher shown only when no session is active, and a user-icon control. The authenticated workspace routes (`/dashboard` and `/settings`) SHALL render the application shell instead of this header. The control's menu SHALL reflect the resolved session state: a loading state while the session check is pending; a sign-in action when no session is active; and, when a session is active, a link to the account settings at `/settings`, a link to the dashboard at `/dashboard`, and a sign-out action. Header copy SHALL be presented in the active locale. When the session check fails without a definitive answer, the header SHALL show a recoverable state and SHALL NOT present the caller as signed out. The header SHALL remain usable on both mobile and desktop widths, SHALL be operable by keyboard, and SHALL return focus to the user control when the menu closes.

#### Scenario: Session check is pending
- **WHEN** a public page renders while the session check has not resolved
- **THEN** the header shows a loading state for the user control and does not yet show either menu

#### Scenario: No active session
- **WHEN** the session check reports no active session
- **THEN** the header's user menu offers a sign-in action that navigates to `/login`

#### Scenario: Active session
- **WHEN** the session check reports an active session
- **THEN** the header's user menu offers a link to the account settings at `/settings`, a link to the dashboard at `/dashboard`, and a sign-out action

#### Scenario: Dashboard entry navigates
- **WHEN** an authenticated user activates the dashboard entry in the header's user menu
- **THEN** the browser navigates to `/dashboard`

#### Scenario: Session check fails without a definitive answer
- **WHEN** the session check fails with a network error or a non-`401` response
- **THEN** the header shows a recoverable state rather than the signed-out menu

#### Scenario: Header on a narrow viewport
- **WHEN** a public page is viewed on a narrow viewport
- **THEN** the header remains visible and its user control and language switcher can be opened and used

#### Scenario: Language switcher is hidden when signed in
- **WHEN** the session check reports an active session
- **THEN** the header does not present the language switcher

#### Scenario: Menu is keyboard operable
- **WHEN** a keyboard user opens the user control and moves through the menu
- **THEN** the menu opens, its items are reachable by keyboard, and the active item is indicated

#### Scenario: Workspace routes render the shell, not the public header
- **WHEN** the browser opens `/dashboard` or `/settings`
- **THEN** the application shell renders and the shared header does not

#### Scenario: Escape closes the menu and restores focus
- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes and focus returns to the user control that opened it
