# Spec Delta

## MODIFIED Requirements

### Requirement: Present the OAuth callback outcome
The `/auth/oauth/callback` route SHALL read the `error` query parameter and SHALL render a failure message when it is present or a success message when it is absent, plus a link back to the account settings page.

#### Scenario: OAuth login succeeded
- **WHEN** the browser opens `/auth/oauth/callback` without an `error` parameter
- **THEN** the page shows a success message that the session was started and offers a link to the account settings page

#### Scenario: OAuth login failed
- **WHEN** the browser opens `/auth/oauth/callback?error=<code>`
- **THEN** the page shows a failure message that includes the error value and offers a link to the account settings page

### Requirement: Present the login flow
The `/login` route SHALL collect an email and a password, SHALL submit them to `POST /auth/login` with credentials included, and on success SHALL continue to an authorized `returnTo` destination when the route was opened with one, and to `/dashboard` otherwise. On success it SHALL apply the caller's stored language preference by requesting `GET /users/me/settings` and continue under that locale prefix, and when the caller has no stored settings it SHALL apply the default language created for the account. The client SHALL accept only the exact value `/dashboard` as an authorized destination; any other value, including an external URL, a protocol-relative host, or a different internal route, SHALL be discarded and the default `/dashboard` continuation SHALL be used. On success it SHALL update the resolved session so that the header and the account settings page reflect the signed-in user and SHALL NOT retain the previous caller's private data. On a `401` response it SHALL show an inline invalid credentials message without revealing whether the email is registered. On a validation or network failure it SHALL show an inline recoverable message. The client MUST NOT persist session material in `localStorage` or any storage other than the HTTP-only session cookie.

#### Scenario: Successful login
- **WHEN** the user submits a valid email and password and `POST /auth/login` succeeds without an authorized `returnTo` destination
- **THEN** the client continues to `/dashboard` and the session is carried by the HTTP-only cookie

#### Scenario: Login applies the stored language
- **WHEN** login succeeds and `GET /users/me/settings` returns a stored language
- **THEN** the client continues to the destination under that locale prefix

#### Scenario: Default language is applied without stored settings
- **WHEN** login succeeds and `GET /users/me/settings` returns `404`
- **THEN** the client applies the created default `en` and continues under `/en`

#### Scenario: Login continues to an authorized destination
- **WHEN** the browser opens `/login?returnTo=%2Fdashboard`, the user submits valid credentials, and `POST /auth/login` succeeds
- **THEN** the client continues to `/dashboard`

#### Scenario: Login discards an unauthorized destination
- **WHEN** the browser opens `/login` with a `returnTo` that is not exactly `/dashboard`
- **THEN** the client discards it and continues to `/dashboard`

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
- **THEN** the header and the account settings page reflect the signed-in user rather than any pre-login session state

#### Scenario: A later user does not inherit previous private data
- **WHEN** a user signs out and a different user signs in on the same browser
- **THEN** the new user sees none of the previous user's session or profile data

### Requirement: Complete signup with a password
The `/complete-signup` route SHALL read the registration token supplied by the email return path and present a single password field with a show/hide control. It SHALL refuse to submit without a token or a valid password and SHALL call `POST /auth/signup/complete` with credentials included. On authenticated success it SHALL update session state, clear previous private caches and token-bearing browser URLs, and navigate to `/settings` so the caller completes the profile in the same flow. Invalid, expired, superseded, or consumed tokens SHALL show a safe link error with a restart action. Rate limits and network/service failures SHALL show recoverable messages. If the API reports that activation committed but session issuance failed, the page SHALL offer normal login with the chosen password rather than another registration. No password or token SHALL be persisted in browser storage or logs.

#### Scenario: Missing token
- **WHEN** `/complete-signup` has no token
- **THEN** no completion can be submitted and the page offers a new signup

#### Scenario: Password can be shown or hidden
- **WHEN** the user toggles the password visibility control
- **THEN** the single password field switches between masked and visible without changing its value

#### Scenario: Activation and authenticated continuation
- **WHEN** completion succeeds with the session cookie
- **THEN** session and private caches are updated, the token-bearing URL is replaced, and `/settings` presents the profile completion form for the authenticated caller

#### Scenario: Expired or unusable link
- **WHEN** completion rejects an expired, invalid, superseded, or consumed token
- **THEN** the page offers a new signup and does not claim activation or authentication

#### Scenario: Operational completion failure
- **WHEN** completion is rate limited or fails without a definitive activation result
- **THEN** the page shows a recoverable error and does not report the token as invalid solely because of that failure

#### Scenario: Activation completed but login did not
- **WHEN** the API explicitly reports committed activation without a session
- **THEN** the page offers `/login` with the established password and does not claim authentication or request another signup
