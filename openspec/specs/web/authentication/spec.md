# web/authentication Specification

## Purpose

Define the browser entry points for session-gated interactions and for the email-verification, password-reset, and OAuth callback routes the API redirects the browser to.

## Requirements

### Requirement: Resolve the active browser session
The web client SHALL determine whether a browser session is active by calling `POST /auth/refresh` with credentials included, SHALL treat a `401` response as "not authenticated" without retrying, SHALL treat any other failure (for example a network failure or a non-`401` response) as an unknown session state that is not "not authenticated", and SHALL expose the resulting state to routes that consume it.

#### Scenario: Active session is recognized
- **WHEN** a browser with an active session opens the application
- **THEN** the session check resolves as authenticated and session-gated routes may render their authenticated content

#### Scenario: Absent session is recognized
- **WHEN** the session check receives `401`
- **THEN** the client treats the caller as not authenticated, performs no further retry, and session-gated routes render their unauthenticated state

#### Scenario: Session check fails without a definitive answer
- **WHEN** the session check fails with a network error or a non-`401` response
- **THEN** the client exposes an unknown session state, does not treat the caller as authenticated, and does not present the caller as signed out

### Requirement: Present the password reset flow
The `/reset-password` route SHALL read the `token` query parameter, SHALL refuse to render the reset form when the token is missing, and SHALL submit a new password to `POST /auth/reset-password/confirm`. It SHALL label the password field accessibly, SHALL report success or failure inline, and SHALL offer a link to `/login` once the password has been updated. It SHALL distinguish an invalid or expired link (`400`) from a network failure and SHALL NOT present a network failure as an invalid link.

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

### Requirement: Present the OAuth callback outcome
The `/auth/oauth/callback` route SHALL read the `error` query parameter and SHALL render a failure message when it is present or a success message when it is absent, plus a link back to `/users`.

#### Scenario: OAuth login succeeded
- **WHEN** the browser opens `/auth/oauth/callback` without an `error` parameter
- **THEN** the page shows a success message that the session was started and offers a link to `/users`

#### Scenario: OAuth login failed
- **WHEN** the browser opens `/auth/oauth/callback?error=<code>`
- **THEN** the page shows a failure message that includes the error value and offers a link to `/users`

### Requirement: Present the login flow
The `/login` route SHALL collect an email and a password, SHALL submit them to `POST /auth/login` with credentials included, and on success SHALL continue to an authorized `returnTo` destination when the route was opened with one, and to `/users` otherwise. The client SHALL accept only the exact value `/dashboard` as an authorized destination; any other value, including an external URL, a protocol-relative host, or a different internal route, SHALL be discarded and the default `/users` continuation SHALL be used. On success it SHALL update the resolved session so that the header and `/users` reflect the signed-in user and SHALL NOT retain the previous caller's private data. On a `401` response it SHALL show an inline invalid credentials message without revealing whether the email is registered. On a validation or network failure it SHALL show an inline recoverable message. The client MUST NOT persist session material in `localStorage` or any storage other than the HTTP-only session cookie.

#### Scenario: Successful login
- **WHEN** the user submits a valid email and password and `POST /auth/login` succeeds without an authorized `returnTo` destination
- **THEN** the client continues to `/users` and the session is carried by the HTTP-only cookie

#### Scenario: Login continues to an authorized destination
- **WHEN** the browser opens `/login?returnTo=%2Fdashboard`, the user submits valid credentials, and `POST /auth/login` succeeds
- **THEN** the client continues to `/dashboard`

#### Scenario: Login discards an unauthorized destination
- **WHEN** the browser opens `/login` with a `returnTo` that is not exactly `/dashboard`
- **THEN** the client discards it and continues to `/users`

#### Scenario: Invalid credentials
- **WHEN** `POST /auth/login` fails with `401`
- **THEN** the page shows an inline invalid credentials message and does not navigate

#### Scenario: Login is rate limited
- **WHEN** `POST /auth/login` returns `429` with a retry interval
- **THEN** the page shows a waiting state and not an invalid-credentials message

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
The `/signup` route SHALL collect only an email and submit it to `POST /auth/signup` with credentials included. It SHALL NOT request or store a password, create a profile, or start a session. On `201`, it SHALL show the pending-verification state, the fixed 48-hour activation deadline, resend, a configured support contact, and a link to `/login`. It SHALL distinguish transport acceptance, failed sending, and throttling without claiming mailbox delivery. Repeated signup for an unexpired pending registration SHALL show the same state without disclosing that registration already existed or extending the displayed deadline. A `409` SHALL show the existing registered-email message; validation, rate-limit, and network/service errors SHALL remain recoverable.

#### Scenario: Successful signup
- **WHEN** the user submits a valid email and signup returns `201` with transport acceptance
- **THEN** the page shows the pending state and deadline, offers resend, support, and login, and creates neither a password nor a session or profile

#### Scenario: Signup with a delivery failure
- **WHEN** signup returns `201` with a failed send outcome
- **THEN** the page says the email could not be sent and offers resend and support without claiming success

#### Scenario: Pending address registered again
- **WHEN** signup is repeated for an unexpired pending registration
- **THEN** the page shows the same pending state and original deadline, requests no password, and does not identify it as a duplicate registration

#### Scenario: Signup is throttled
- **WHEN** signup reports throttling and a retry interval
- **THEN** the page shows the waiting state and prevents repeated sends until that interval elapses

#### Scenario: Email already registered
- **WHEN** signup returns `409` for an active identity
- **THEN** the page shows an inline message that the email is already registered

#### Scenario: Signup fails without a definitive answer
- **WHEN** signup fails with validation, rate limiting, network, or service errors
- **THEN** the page shows the appropriate recoverable message and does not claim the account was created or the email sent

### Requirement: Present the verification resend flow
The pending state SHALL call `POST /auth/verification/resend` with credentials included. Its confirmation SHALL report request acceptance only, using non-disclosing conditional copy without claiming sending or delivery. It SHALL show the original registration deadline, explain that a new signup is needed after 48 hours, and disable resend until any returned retry interval elapses. When the displayed deadline passes, it SHALL offer restart at `/signup` rather than continue resending. Network or service failures SHALL remain recoverable and SHALL NOT start a session or create a profile.

#### Scenario: Resend accepted
- **WHEN** the user resends and receives uniform request acceptance
- **THEN** conditional confirmation is shown without claiming delivery, and the original registration deadline remains unchanged

#### Scenario: Resend rate limited
- **WHEN** resend reports a retry interval
- **THEN** the action is disabled for that interval and the message reveals no account state

#### Scenario: Registration deadline passes
- **WHEN** the displayed 48-hour deadline passes
- **THEN** the page offers a new signup and no longer presents resend as a way to extend the registration

#### Scenario: Resend fails without a definitive answer
- **WHEN** resend fails with a network or service error
- **THEN** an inline recoverable message appears without changing the registration deadline or claiming sending succeeded

### Requirement: Complete signup with a password
The `/complete-signup` route SHALL read the registration token supplied by the email return path and present a single password field with a show/hide control. It SHALL refuse to submit without a token or a valid password and SHALL call `POST /auth/signup/complete` with credentials included. On authenticated success it SHALL update session state, clear previous private caches and token-bearing browser URLs, and navigate to `/users` so the caller completes the profile in the same flow. Invalid, expired, superseded, or consumed tokens SHALL show a safe link error with a restart action. Rate limits and network/service failures SHALL show recoverable messages. If the API reports that activation committed but session issuance failed, the page SHALL offer normal login with the chosen password rather than another registration. No password or token SHALL be persisted in browser storage or logs.

#### Scenario: Missing token
- **WHEN** `/complete-signup` has no token
- **THEN** no completion can be submitted and the page offers a new signup

#### Scenario: Password can be shown or hidden
- **WHEN** the user toggles the password visibility control
- **THEN** the single password field switches between masked and visible without changing its value

#### Scenario: Activation and authenticated continuation
- **WHEN** completion succeeds with the session cookie
- **THEN** session and private caches are updated, the token-bearing URL is replaced, and `/users` presents the profile completion form for the authenticated caller

#### Scenario: Expired or unusable link
- **WHEN** completion rejects an expired, invalid, superseded, or consumed token
- **THEN** the page offers a new signup and does not claim activation or authentication

#### Scenario: Operational completion failure
- **WHEN** completion is rate limited or fails without a definitive activation result
- **THEN** the page shows a recoverable error and does not report the token as invalid solely because of that failure

#### Scenario: Activation completed but login did not
- **WHEN** the API explicitly reports committed activation without a session
- **THEN** the page offers `/login` with the established password and does not claim authentication or request another signup

### Requirement: Offer registration support
Signup and pending-registration screens SHALL obtain the public support email from `GET /auth/public-config` and offer an accessible email contact for users who have not received the message. The browser SHALL receive no SMTP credentials or auth secrets. Missing development configuration or a failed config request SHALL NOT result in a fabricated email address or prevent the user from using signup and resend.

#### Scenario: Configured support email
- **WHEN** public config provides a valid support contact
- **THEN** signup and pending screens offer a mail link to that address

#### Scenario: Public config is unavailable
- **WHEN** support configuration cannot be obtained or is absent in development
- **THEN** no fabricated contact is shown and signup and resend remain usable

### Requirement: Present the password recovery request
The `/forgot-password` route SHALL collect an email and submit it to `POST /auth/reset-password/request`. On success it SHALL show a uniform confirmation that does not disclose whether an account exists. On a validation or network failure it SHALL show an inline recoverable message.

#### Scenario: Recovery requested
- **WHEN** the user submits an email and `POST /auth/reset-password/request` succeeds
- **THEN** the page shows a uniform confirmation that does not reveal whether the email is registered

#### Scenario: Recovery request fails without a definitive answer
- **WHEN** the recovery request fails with a validation error or a network failure
- **THEN** the page shows an inline recoverable message

### Requirement: End the browser session and clear private state
The "Cerrar sesión" action SHALL call `POST /auth/logout` with credentials included and, upon completion, SHALL clear the cached session and profile data so that a subsequent user cannot see the previous session's private data. After a successful logout the client SHALL present the unauthenticated state. When logout fails without a definitive answer, the client SHALL show a recoverable message and SHALL NOT present the caller as signed out while the session may still be active.

#### Scenario: Successful logout clears private state
- **WHEN** an authenticated user activates "Cerrar sesión" and `POST /auth/logout` succeeds
- **THEN** the session and profile caches are cleared and the header offers the "Acceder" action

#### Scenario: Logout fails without a definitive answer
- **WHEN** `POST /auth/logout` fails with a network error
- **THEN** the client shows a recoverable message and does not present the caller as signed out
