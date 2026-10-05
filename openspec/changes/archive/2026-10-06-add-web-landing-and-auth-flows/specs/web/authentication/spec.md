# Spec Delta

## MODIFIED Requirements

### Requirement: Resolve the active browser session

The web client SHALL determine whether a browser session is active by calling
`POST /auth/refresh` with credentials included, SHALL treat a `401` response as
"not authenticated" without retrying, SHALL treat any other failure (for example
a network failure or a non-`401` response) as an unknown session state that is
not "not authenticated", and SHALL expose the resulting state to routes that
consume it.

#### Scenario: Active session is recognized
- **WHEN** a browser with an active session opens the application
- **THEN** the session check resolves as authenticated and session-gated routes may render their authenticated content

#### Scenario: Absent session is recognized
- **WHEN** the session check receives `401`
- **THEN** the client treats the caller as not authenticated, performs no further retry, and session-gated routes render their unauthenticated state

#### Scenario: Session check fails without a definitive answer
- **WHEN** the session check fails with a network error or a non-`401` response
- **THEN** the client exposes an unknown session state, does not treat the caller as authenticated, and does not present the caller as signed out

### Requirement: Present the email verification outcome

The `/verified` route SHALL read the `verified` and `error` query parameters,
SHALL render the matching outcome message, and SHALL offer a link that continues
to `/login`. The message SHALL NOT claim that verification started an
authenticated session.

#### Scenario: Verification succeeded
- **WHEN** the browser opens `/verified?verified=true`
- **THEN** the page confirms that the email was verified, does not claim that a session was started, and offers a link to `/login`

#### Scenario: Verification failed
- **WHEN** the browser opens `/verified?error=<code>`
- **THEN** the page shows a failure message that includes the error value and offers a link to `/login`

### Requirement: Present the password reset flow

The `/reset-password` route SHALL read the `token` query parameter, SHALL refuse
to render the reset form when the token is missing, and SHALL submit a new
password to `POST /auth/reset-password/confirm`. It SHALL label the password
field accessibly, SHALL report success or failure inline, and SHALL offer a link
to `/login` once the password has been updated. It SHALL distinguish an invalid
or expired link (`400`) from a network failure and SHALL NOT present a network
failure as an invalid link.

#### Scenario: Missing reset token
- **WHEN** the browser opens `/reset-password` without a `token` value
- **THEN** the page shows a missing-token message and does not render the password form

#### Scenario: Reset accepted
- **WHEN** the browser opens `/reset-password` with a token, the user submits a password meeting the field's minimum length, and `POST /auth/reset-password/confirm` succeeds
- **THEN** the page replaces the form with a confirmation that the password was updated and offers a link to `/login`

#### Scenario: Reset rejected
- **WHEN** `POST /auth/reset-password/confirm` fails with `400` for a submitted token and password
- **THEN** the page shows an inline message that the link is invalid or expired and no confirmation is shown

#### Scenario: Reset fails without a definitive answer
- **WHEN** `POST /auth/reset-password/confirm` fails with a network error
- **THEN** the page shows a recoverable message that is not the invalid-link message and no confirmation is shown

## ADDED Requirements

### Requirement: Present the login flow

The `/login` route SHALL collect an email and a password, SHALL submit them to
`POST /auth/login` with credentials included, and SHALL continue to `/users` when
the request succeeds. On success it SHALL update the resolved session so that the
header and `/users` reflect the signed-in user and SHALL NOT retain the previous
caller's private data. On a `401` response it SHALL show an inline invalid
credentials message without revealing whether the email is registered. On a
validation or network failure it SHALL show an inline recoverable message. The
client MUST NOT persist session material in `localStorage` or any storage other
than the HTTP-only session cookie.

#### Scenario: Successful login
- **WHEN** the user submits a valid email and password and `POST /auth/login` succeeds
- **THEN** the client continues to `/users` and the session is carried by the HTTP-only cookie

#### Scenario: Invalid credentials
- **WHEN** `POST /auth/login` fails with `401`
- **THEN** the page shows an inline invalid credentials message and does not navigate

#### Scenario: Login fails without a definitive answer
- **WHEN** login fails with a validation error or a network failure
- **THEN** the page shows an inline recoverable message and does not treat the caller as signed in

#### Scenario: No token is persisted
- **WHEN** a login succeeds
- **THEN** no session token is written to `localStorage` or any non-HTTP-only storage

#### Scenario: Login updates the session state
- **WHEN** `POST /auth/login` succeeds
- **THEN** the header and `/users` reflect the signed-in user rather than any pre-login session state

#### Scenario: A later user does not inherit previous private data
- **WHEN** a user signs out and a different user signs in on the same browser
- **THEN** the new user sees none of the previous user's session or profile data

### Requirement: Present the signup flow

The `/signup` route SHALL collect an email and a password, SHALL submit them to
`POST /auth/signup` with credentials included, and SHALL NOT create a profile and
SHALL NOT start a session. When the request succeeds it SHALL replace the form
with a confirmation that an email has been sent and that the address must be
verified before signing in. On a `409` it SHALL show an inline message that the
email is already registered. On a validation or network failure it SHALL show an
inline recoverable message.

#### Scenario: Successful signup
- **WHEN** the user submits a valid email and password and `POST /auth/signup` returns `201`
- **THEN** the page confirms that a verification email was sent, remains unauthenticated, and creates no profile

#### Scenario: Email already registered
- **WHEN** `POST /auth/signup` returns `409`
- **THEN** the page shows an inline message that the email is already registered

#### Scenario: Signup fails without a definitive answer
- **WHEN** signup fails with a validation error or a network failure
- **THEN** the page shows an inline recoverable message

### Requirement: Present the password recovery request

The `/forgot-password` route SHALL collect an email and submit it to
`POST /auth/reset-password/request`. On success it SHALL show a uniform
confirmation that does not disclose whether an account exists. On a validation or
network failure it SHALL show an inline recoverable message.

#### Scenario: Recovery requested
- **WHEN** the user submits an email and `POST /auth/reset-password/request` succeeds
- **THEN** the page shows a uniform confirmation that does not reveal whether the email is registered

#### Scenario: Recovery request fails without a definitive answer
- **WHEN** the recovery request fails with a validation error or a network failure
- **THEN** the page shows an inline recoverable message

### Requirement: End the browser session and clear private state

The "Cerrar sesión" action SHALL call `POST /auth/logout` with credentials
included and, upon completion, SHALL clear the cached session and profile data so
that a subsequent user cannot see the previous session's private data. After a
successful logout the client SHALL present the unauthenticated state. When logout
fails without a definitive answer, the client SHALL show a recoverable message
and SHALL NOT present the caller as signed out while the session may still be
active.

#### Scenario: Successful logout clears private state
- **WHEN** an authenticated user activates "Cerrar sesión" and `POST /auth/logout` succeeds
- **THEN** the session and profile caches are cleared and the header offers the "Acceder" action

#### Scenario: Logout fails without a definitive answer
- **WHEN** `POST /auth/logout` fails with a network error
- **THEN** the client shows a recoverable message and does not present the caller as signed out
