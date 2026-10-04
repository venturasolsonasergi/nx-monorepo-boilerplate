# web/navigation Specification

## Purpose
Define the browser client's route surface and the in-app links that connect its pages, so navigation stays coherent across auth and profile flows.

## Requirements

### Requirement: Serve the application route surface
The web application SHALL resolve each implemented route to its page: the root `/`, the profile page `/users`, the email-verification page `/verified`, the password-reset page `/reset-password`, and the OAuth callback page `/auth/oauth/callback`.

#### Scenario: Known route is opened
- **WHEN** the browser opens one of `/`, `/users`, `/verified`, `/reset-password`, or `/auth/oauth/callback`
- **THEN** the page registered for that path is rendered

#### Scenario: Route content loads lazily
- **WHEN** a lazily loaded route is resolving
- **THEN** the layout shows a loading indicator until the page content is ready

### Requirement: Provide in-app links between pages
The verification and OAuth callback pages SHALL each offer a link to `/users`. The unauthenticated `/users` state SHALL NOT present `/verified` as a way to start login or request a verification email, because the client has no login or verification-request screen.

#### Scenario: Continue after verification or OAuth
- **WHEN** the `/verified` or `/auth/oauth/callback` page is shown
- **THEN** it presents a link that navigates to `/users`

#### Scenario: Recover from missing session
- **WHEN** the `/users` page is shown without an active session
- **THEN** it does not present a link to `/verified` as an action to sign in or request email verification
