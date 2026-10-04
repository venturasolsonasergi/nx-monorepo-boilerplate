# Spec Delta

## MODIFIED Requirements

### Requirement: Provide in-app links between pages
The verification and OAuth callback pages SHALL each offer a link to `/users`. The unauthenticated `/users` state SHALL NOT present `/verified` as a way to start login or request a verification email, because the client has no login or verification-request screen.

#### Scenario: Continue after verification or OAuth
- **WHEN** the `/verified` or `/auth/oauth/callback` page is shown
- **THEN** it presents a link that navigates to `/users`

#### Scenario: Recover from missing session
- **WHEN** the `/users` page is shown without an active session
- **THEN** it does not present a link to `/verified` as an action to sign in or request email verification