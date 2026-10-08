# Spec Delta

## MODIFIED Requirements

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
