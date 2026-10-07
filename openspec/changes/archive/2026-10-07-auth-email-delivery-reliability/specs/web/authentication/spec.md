# Spec Delta

## MODIFIED Requirements

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

### Requirement: Present the login flow
The `/login` route SHALL collect an email and password, submit them to `POST /auth/login` with credentials included, and continue to `/users` on success. It SHALL update resolved session state and remove the previous caller's private data. A `401` SHALL show a non-disclosing invalid-credentials message; a `429` SHALL show a retry waiting state rather than invalid credentials. Validation, network, and service failures SHALL show recoverable messages without claiming authentication. The client MUST NOT persist session material outside the HTTP-only cookie.

#### Scenario: Successful login
- **WHEN** valid verified credentials are accepted
- **THEN** the browser continues to `/users` with the session cookie

#### Scenario: Invalid credentials
- **WHEN** login returns `401`
- **THEN** an inline invalid-credentials message is shown without disclosing account existence or navigating

#### Scenario: Login is rate limited
- **WHEN** login returns `429` with a retry interval
- **THEN** the page shows a waiting state and not an invalid-credentials message

#### Scenario: Login fails without a definitive answer
- **WHEN** validation, network, or service failure prevents login
- **THEN** a recoverable message is shown and the client does not claim authentication

#### Scenario: No token is persisted
- **WHEN** login succeeds
- **THEN** no session material is stored in localStorage or any non-HTTP-only storage

#### Scenario: Login updates the session state
- **WHEN** login succeeds
- **THEN** the header and `/users` reflect the signed-in identity instead of pre-login state

#### Scenario: A later user does not inherit previous private data
- **WHEN** a different user signs in after logout on the same browser
- **THEN** no private session or profile data from the previous user is shown

## REMOVED Requirements

### Requirement: Present the email verification outcome
The standalone `/verified` outcome screen is removed. The email link returns to `/complete-signup`, which resolves the actual browser session and handles link errors, activation, and post-activation continuation; a successful activation continues directly to `/users` to complete the profile. Query parameters remain non-proof of authentication, and the header still reflects the resolved session.

#### Scenario: Verification succeeded
- **WHEN** the browser reaches `/verified` after completing registration and the session check confirms authentication
- **THEN** the route is retired and the browser is sent to `/users` after activation instead

#### Scenario: Outcome URL has no session
- **WHEN** the browser opens `/verified?verified=true` without an authenticated session
- **THEN** the retired route provides no proof of login and the user is directed to the profile flow, which resolves the real session

#### Scenario: Verification failed
- **WHEN** the browser reaches the verification outcome with an invalid or expired registration-link error
- **THEN** `/complete-signup` displays the safe failure message and offers `/signup` to restart

#### Scenario: Session outcome is unknown
- **WHEN** session resolution is rate limited or fails operationally
- **THEN** the profile flow shows a recoverable unknown state without claiming authenticated completion or definitive logout

## ADDED Requirements

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
