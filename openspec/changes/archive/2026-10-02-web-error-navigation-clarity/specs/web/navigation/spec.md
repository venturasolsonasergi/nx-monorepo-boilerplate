# Spec Delta

## MODIFIED Requirements

### Requirement: Provide in-app links between pages
The verification and OAuth callback pages SHALL each offer a link to `/users`, and the unauthenticated `/users` state SHALL offer a link to `/verified`. The client hosts no login or verification-request screen, so the `/verified` link is a navigation affordance only and does not by itself start login, send a verification email, or establish a session.

#### Scenario: Continue after verification or OAuth
- **WHEN** the `/verified` or `/auth/oauth/callback` page is shown
- **THEN** it presents a link that navigates to `/users`

#### Scenario: Recover from missing session
- **WHEN** the `/users` page is shown without an active session
- **THEN** it presents a link that navigates to `/verified` without starting login, sending a verification email, or establishing a session
