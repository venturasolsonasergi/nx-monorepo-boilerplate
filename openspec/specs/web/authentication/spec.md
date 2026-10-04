# web/authentication Specification

## Purpose
Define the browser entry points for session-gated interactions and for the email-verification, password-reset, and OAuth callback routes the API redirects the browser to.

## Requirements

### Requirement: Resolve the active browser session
The web client SHALL determine whether a browser session is active by calling `POST /auth/refresh` with credentials included, SHALL treat a `401` response as "not authenticated" without retrying, and SHALL expose that result to routes that require a session.

#### Scenario: Active session is recognized
- **WHEN** a browser with an active session opens the application
- **THEN** the session check resolves as authenticated and session-gated routes may render their authenticated content

#### Scenario: Absent session is recognized
- **WHEN** the session check receives `401`
- **THEN** the client treats the caller as not authenticated, performs no further retry, and session-gated routes render their unauthenticated state

### Requirement: Present the email verification outcome
The `/verified` route SHALL read the `verified` and `error` query parameters and SHALL render the matching outcome message, plus a link back to `/users`. When verification succeeds, the message SHALL confirm the email was verified without implying that the browser client provides a sign-in flow.

#### Scenario: Verification succeeded
- **WHEN** the browser opens `/verified?verified=true`
- **THEN** the page confirms that the email was verified, does not claim that the user can sign in through the client, and offers a link to `/users`

#### Scenario: Verification failed
- **WHEN** the browser opens `/verified?error=<code>`
- **THEN** the page shows a failure message that includes the error value and offers a link to `/users`

### Requirement: Present the password reset flow
The `/reset-password` route SHALL read the `token` query parameter, SHALL refuse to render the reset form when the token is missing, and SHALL submit a new password to `POST /auth/reset-password/confirm`, reporting success or failure inline.

#### Scenario: Missing reset token
- **WHEN** the browser opens `/reset-password` without a `token` value
- **THEN** the page shows a missing-token message and does not render the password form

#### Scenario: Reset accepted
- **WHEN** the browser opens `/reset-password` with a token, the user submits a password meeting the field's minimum length, and `POST /auth/reset-password/confirm` succeeds
- **THEN** the page replaces the form with a confirmation that the password was updated

#### Scenario: Reset rejected
- **WHEN** `POST /auth/reset-password/confirm` fails for a submitted token and password
- **THEN** the page shows an inline message that the link is invalid or expired and no confirmation is shown

### Requirement: Present the OAuth callback outcome
The `/auth/oauth/callback` route SHALL read the `error` query parameter and SHALL render a failure message when it is present or a success message when it is absent, plus a link back to `/users`.

#### Scenario: OAuth login succeeded
- **WHEN** the browser opens `/auth/oauth/callback` without an `error` parameter
- **THEN** the page shows a success message that the session was started and offers a link to `/users`

#### Scenario: OAuth login failed
- **WHEN** the browser opens `/auth/oauth/callback?error=<code>`
- **THEN** the page shows a failure message that includes the error value and offers a link to `/users`
