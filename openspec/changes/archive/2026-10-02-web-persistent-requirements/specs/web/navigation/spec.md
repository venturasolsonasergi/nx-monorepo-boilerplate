# Spec Delta

## Purpose

Define the browser client's route surface and the in-app links that connect its pages, so navigation stays coherent across auth and profile flows.

## ADDED Requirements

### Requirement: Serve the application route surface
The web application SHALL resolve each implemented route to its page: the root `/`, the profile page `/users`, the email-verification page `/verified`, the password-reset page `/reset-password`, and the OAuth callback page `/auth/oauth/callback`.

#### Scenario: Known route is opened
- **WHEN** the browser opens one of `/`, `/users`, `/verified`, `/reset-password`, or `/auth/oauth/callback`
- **THEN** the page registered for that path is rendered

#### Scenario: Route content loads lazily
- **WHEN** a lazily loaded route is resolving
- **THEN** the layout shows a loading indicator until the page content is ready

### Requirement: Provide in-app links between pages
The verification and OAuth callback pages SHALL each offer a link to `/users`, and the unauthenticated `/users` state SHALL offer a link to `/verified`, so that a user can continue or recover within the application.

#### Scenario: Continue after verification or OAuth
- **WHEN** the `/verified` or `/auth/oauth/callback` page is shown
- **THEN** it presents a link that navigates to `/users`

#### Scenario: Recover from missing session
- **WHEN** the `/users` page is shown without an active session
- **THEN** it presents a link that navigates to `/verified`
