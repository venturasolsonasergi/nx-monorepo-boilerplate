# Spec: Identity Sessions

## Purpose

Provide a single authoritative identity and browser-session contract for registering, verifying, authenticating, and recovering accounts without owning business profile data.

## Requirements

### Requirement: Register an identity pending email verification
The auth service SHALL accept only a valid email at `POST /auth/signup`, normalize it, and create a pending registration without creating an identity, credential, session, or profile. It SHALL return `201` with pending-verification status, the registration deadline, and `emailStatus: accepted | failed | throttled`, with a retry interval when throttled and no `userId`. A source-blocked signup SHALL instead return `429` with a retry interval and SHALL create no pending registration or per-address limit state. An accepted mail outcome SHALL mean transport acceptance, not mailbox delivery. Each registration SHALL expire exactly 48 hours after initiation; repeating signup while it is pending SHALL reuse it and SHALL NOT extend its deadline. The initial send and subsequent sends SHALL share the same rate limits. A verified identity with that email SHALL still produce `409`; invalid input, including a password in the email-only request, SHALL produce `400`.

#### Scenario: Successful signup
- **WHEN** a client submits a valid, unregistered email and the initial message is accepted by the mail transport
- **THEN** the service returns `201` with pending-verification status, `emailStatus: accepted`, and a deadline 48 hours after initiation, sends the activation link, and creates no identity, credential, profile, or session

#### Scenario: Duplicate or invalid signup
- **WHEN** the email belongs to a verified identity or the request is invalid
- **THEN** the service returns `409` for that identity or `400` for invalid input and creates no registration, identity, credential, or session and sends no activation email

#### Scenario: Initial email fails
- **WHEN** the pending registration is created but SMTP does not accept the message
- **THEN** signup returns `201` with `emailStatus: failed`, preserves the registration and its deadline for resend, and does not claim delivery or create a session

#### Scenario: Initial send participates in the rate limit
- **WHEN** initial signup and a resend for the same address occur within the address window, sequentially or concurrently
- **THEN** at most one activation email is sent in that window and a limited request receives a retry interval

#### Scenario: Signup source is blocked
- **WHEN** a source has exhausted its signup limit
- **THEN** signup returns `429` with the retry interval and does not create pending-registration or per-address limit state

#### Scenario: Pending email registered again
- **WHEN** signup is repeated for an unexpired pending registration
- **THEN** the service reuses that registration, attempts a rate-limited resend without extending the original deadline, and returns the same pending response shape without identifying it as a duplicate registration

#### Scenario: Signup restarts an expired registration
- **WHEN** signup is submitted after the previous registration's 48-hour deadline, even if cleanup has not run
- **THEN** a new registration starts with a new deadline and every link from the previous registration remains unusable

### Requirement: Verify an email address
The auth service SHALL complete email/password registration only when `POST /auth/signup/complete` receives a valid, unexpired, single-use registration token and a valid password. It SHALL bind the token to the current registration, establish the verified identity and credential with the submitted password, consume the token, and issue an authenticated HTTP-only session cookie on success. Identity and credential persistence and token consumption SHALL be atomic. `GET /auth/verify-email` SHALL only redirect to the approved web password-entry route and SHALL NOT consume a token, verify an identity, or create a session. The former password-free `POST /auth/verify-email` SHALL return `410` without activating an identity or issuing a session. Completion SHALL NOT create a business profile.

#### Scenario: Email link opens the password form
- **WHEN** a browser or mail-link scanner follows the activation link to `GET /auth/verify-email`
- **THEN** the API redirects to `/complete-signup` on the configured web origin with the token and makes no identity, credential, verification, or session change

#### Scenario: Valid verification token
- **WHEN** the owner submits a valid registration token and a valid password to `POST /auth/signup/complete`
- **THEN** the service creates one verified identity and its credential, consumes the token, and returns the authenticated result with the session cookie so the browser can continue already signed in

#### Scenario: Reused verification token
- **WHEN** a consumed registration token is submitted again after successful activation
- **THEN** completion returns `400` without changing the credential or issuing another session, and merely opening the link again cannot sign anyone in

#### Scenario: Invalid password does not consume the link
- **WHEN** completion supplies a valid token but a password that fails validation
- **THEN** the service returns `400`, creates no identity or session, and leaves the token usable until its deadline

#### Scenario: Invalid or expired verification token
- **WHEN** completion supplies an invalid token, a consumed token, a superseded link, or a token at or after the registration deadline
- **THEN** the service rejects completion with `400`, creates no session, changes no credential, and requires a new signup for an expired registration

#### Scenario: Concurrent activation requests
- **WHEN** two completion requests use the same token concurrently
- **THEN** exactly one can activate the registration and establish its credential, and the other cannot replace that password or issue another session

#### Scenario: Account activation commits but session issuance fails
- **WHEN** activation commits but an operational failure prevents issuing the session
- **THEN** the response reports the operational failure and that activation completed, does not claim the browser is authenticated, and the owner can log in with the established password without another signup

#### Scenario: Legacy verification cannot bypass password activation
- **WHEN** an old token is submitted to the former `POST /auth/verify-email` endpoint
- **THEN** the endpoint returns `410` and does not verify the account, change a credential, or issue a session

### Requirement: Log in with verified credentials
The auth service SHALL issue a browser session for valid email/password credentials only when the identity's email is verified; session cookies SHALL be HTTP-only and protected in production transport. It SHALL reject unverified identities before creating a session. Invalid credentials and unverified identities SHALL return a non-disclosing `401`. Rate limits SHALL return `429` with a retry interval, and operational failures SHALL remain non-`401` errors rather than being reported as invalid credentials.

#### Scenario: Verified identity logs in
- **WHEN** a client calls `POST /auth/login` with valid credentials for a verified identity
- **THEN** the service returns the authenticated result and sets the session cookie

#### Scenario: Unverified or invalid credentials
- **WHEN** credentials are invalid or belong to an unverified identity
- **THEN** the service returns the same non-disclosing `401` and creates no session

#### Scenario: Login is rate limited
- **WHEN** the request exceeds the login limit
- **THEN** login returns `429` with the retry interval rather than `401`

#### Scenario: Login service fails
- **WHEN** a dependency failure prevents checking credentials or issuing a session
- **THEN** the service returns a recoverable non-`401` error and does not describe it as invalid credentials

### Requirement: Validate and end browser sessions
The auth service SHALL reject missing, invalid, revoked, expired, or unverified sessions, expose the authenticated userId only for a valid verified session, and revoke the active session on logout. Rate-limited or operationally failed session checks SHALL NOT be interpreted as absent sessions and SHALL preserve a non-`401` failure response.

#### Scenario: Valid session on protected route
- **WHEN** a client presents a valid verified session to a protected route
- **THEN** the route receives that session's userId and permits the authorized operation

#### Scenario: Invalid or missing session
- **WHEN** the session is absent, invalid, revoked, expired, or belongs to an unverified identity
- **THEN** the service returns `401` without exposing protected data

#### Scenario: Logout
- **WHEN** an authenticated client requests logout
- **THEN** the current session is revoked and its cookie cleared, and subsequent use of that session is rejected

#### Scenario: Session validation cannot obtain a definitive answer
- **WHEN** the session provider responds with a rate limit or an operational failure
- **THEN** the service preserves `429` or an appropriate service failure and does not replace it with `401`

### Requirement: Renew an active browser session
The auth service SHALL renew an active verified browser session through `POST /auth/refresh` within its session policy and deliver any replacement cookie. It SHALL return `401` only for absent, invalid, revoked, expired, or unverified sessions. It SHALL preserve `429` with its retry interval and operational failures as non-`401` responses, without declaring the existing session invalid solely because the check failed.

#### Scenario: Refresh an active session
- **WHEN** an authenticated client refreshes an active verified session
- **THEN** the service returns the authenticated userId and delivers any replacement cookie

#### Scenario: Refresh an expired or revoked session
- **WHEN** refresh supplies an expired, revoked, invalid, or absent session
- **THEN** the service returns `401` and issues no new session

#### Scenario: Refresh an unverified session
- **WHEN** refresh supplies a session belonging to an unverified identity
- **THEN** the service returns `401` and does not renew that session

#### Scenario: Refresh is rate limited or unavailable
- **WHEN** the provider limits the request or a dependency fails during refresh
- **THEN** the service returns `429` with the retry interval or an appropriate operational failure, not `401`

### Requirement: Resend a verification email
The service SHALL accept `POST /auth/verification/resend` with an email and return a uniform request-acceptance response for pending, unknown, expired, and verified addresses. It SHALL send only for an unexpired pending registration when the shared limits allow, SHALL NOT extend the registration deadline, and SHALL NOT create a registration for an unknown or expired address. An allowed send SHALL rotate the single-use token bound to that registration so prior links are superseded. The response SHALL NOT claim transport acceptance or delivery or disclose account existence; an SMTP failure SHALL be logged without changing this public acceptance response. A throttled request SHALL include a retry interval uniformly across address states.

#### Scenario: Resend for a pending registration
- **WHEN** an unexpired pending registration requests resend and the limits allow
- **THEN** a new link is sent with the original registration deadline, older links are unusable, and the service returns uniform request acceptance without a session

#### Scenario: Unknown, expired, or verified address
- **WHEN** resend is requested for an unknown address, an expired registration, or a verified identity
- **THEN** the service returns the same acceptance response, sends no email, and creates no registration or session

#### Scenario: Resend is throttled
- **WHEN** an address or source has exhausted its shared window
- **THEN** resend sends no email, leaves any token unchanged, and returns the uniform response with the retry interval

#### Scenario: Concurrent resend requests
- **WHEN** resend requests for the same address run concurrently
- **THEN** at most one sends in the address window and only its token rotation can take effect

#### Scenario: Resend transport failure
- **WHEN** SMTP fails after an allowed resend
- **THEN** the failure is recorded operationally, the registration retains its original deadline and remains recoverable by a later resend, and the response does not disclose the address state

#### Scenario: Invalid resend request
- **WHEN** resend does not supply a valid email
- **THEN** the service returns `400` and sends no email

### Requirement: Expire and clean pending registrations
The service SHALL enforce the fixed 48-hour deadline on every activation and resend, independently of cleanup. It SHALL periodically remove expired pending-registration state without deleting active identities, OAuth accounts, or business profiles. Restart and cleanup SHALL coordinate with activation so an expired or replaced registration cannot activate and a successful activation cannot be removed. Legacy unverified identities SHALL NOT be bulk-deleted solely because of their age.

#### Scenario: Expiry is enforced before cleanup
- **WHEN** an activation is submitted at or after the deadline while its pending row still exists
- **THEN** activation is rejected without creating a credential or session

#### Scenario: Cleanup removes abandoned registrations
- **WHEN** the cleanup process finds expired pending registrations
- **THEN** it removes their registration state without modifying active identities, OAuth accounts, or profiles

#### Scenario: Activation races cleanup or restart
- **WHEN** activation and cleanup or restart access the same pending registration concurrently
- **THEN** only a still-current, unexpired registration can activate and no completed identity is deleted

#### Scenario: Legacy account transition
- **WHEN** an existing unverified local identity enters the replacement registration flow
- **THEN** no password is changed before proof of email control, its existing identity ID is preserved on eligible completion, and OAuth-linked or externally referenced identities are not automatically deleted or replaced

### Requirement: Bound registration and authentication abuse
Initial signup and resend SHALL share an atomic per-address window and a per-source limit. The source limit SHALL be evaluated before creating pending-registration or per-address throttle state; a blocked source SHALL create neither. Rate-limit state SHALL expire. Client-source attribution for signup, completion, login, and session checks SHALL use the trusted network origin rather than arbitrary forwarded headers, and independent clients SHALL NOT unintentionally share one global authentication bucket.

#### Scenario: Many distinct addresses from a blocked source
- **WHEN** a source at its limit submits many different addresses
- **THEN** no emails are sent and no new pending registrations or per-address limit rows are created for them

#### Scenario: Authentication limits isolate clients
- **WHEN** one source exhausts its login limit and a different source submits valid credentials
- **THEN** the second source can authenticate without inheriting the first source's limit

#### Scenario: Spoofed source headers
- **WHEN** an untrusted client changes forwarded-IP headers
- **THEN** those values do not override the trusted source attribution or bypass its limits

#### Scenario: Throttle state expires
- **WHEN** throttle state is older than the retention period, which is at least the longest configured window
- **THEN** cleanup removes it without prematurely resetting an active limit

### Requirement: Publish the support contact
The service SHALL expose only the configured public support email through `GET /auth/public-config` so clients can offer help when registration mail is not received. The contact SHALL be configured by `AUTH_SUPPORT_EMAIL`, validated as an email when present, and required in production. Public configuration SHALL NOT contain SMTP credentials, auth secrets, tokens, or private account data.

#### Scenario: Configured support contact
- **WHEN** a client requests public auth configuration in a configured deployment
- **THEN** it receives the public support email without any secrets or account data

#### Scenario: Invalid or missing production support contact
- **WHEN** the service starts with an invalid configured support email or no support email in production
- **THEN** configuration validation fails with an actionable configuration error

### Requirement: Validate the mail transport at startup
In production, the auth service SHALL validate that the mail transport configuration is present and syntactically valid before accepting requests and SHALL refuse to start when it is missing or invalid. It SHALL NOT refuse to start because SMTP is temporarily unreachable, and successful validation SHALL NOT imply that a message will be accepted or delivered. Outside production the service SHALL start without SMTP, and an attempted send SHALL report failure rather than silently log the activation link as a substitute.

#### Scenario: Valid production configuration
- **WHEN** production starts with valid SMTP configuration
- **THEN** it starts without requiring a connectivity or delivery proof

#### Scenario: Missing or invalid production configuration
- **WHEN** production starts with missing or syntactically invalid SMTP configuration
- **THEN** startup fails before accepting requests

#### Scenario: Transient transport unavailability
- **WHEN** production starts with valid configuration while SMTP is temporarily unreachable
- **THEN** it starts and treats sending as degraded

#### Scenario: Development without SMTP
- **WHEN** development starts without SMTP configuration
- **THEN** startup succeeds and sending fails explicitly without exposing the activation token in a logging fallback

### Requirement: Recover access with a password reset
The auth service SHALL accept password reset requests without disclosing account existence and SHALL change a password only with a valid, unexpired, single-use reset token.

#### Scenario: Request a reset
- **WHEN** a client sends an email to `POST /auth/reset-password/request`
- **THEN** the service returns the same non-disclosing response whether or not the email exists, and sends a reset link or token only for an eligible identity

#### Scenario: Confirm a reset
- **WHEN** a client submits a valid reset token and a valid new password to `POST /auth/reset-password/confirm`
- **THEN** the password is changed, the token is consumed, and previously active sessions for that identity are revoked

#### Scenario: Invalid reset token
- **WHEN** a client submits an invalid, expired, or reused reset token
- **THEN** the service rejects the change without altering credentials

### Requirement: Authenticate with a configured OAuth provider
The auth service SHALL offer `POST /auth/oauth/:provider` for configured providers and complete the provider callback without accepting a caller-supplied identity or redirect to an untrusted origin.

#### Scenario: Supported provider with verified email
- **WHEN** a client starts the flow for a configured provider and the provider callback confirms a verified email
- **THEN** the service links or creates one identity, sets an authenticated session cookie, and redirects to an approved web destination

#### Scenario: Unsupported provider or failed callback
- **WHEN** a provider is not configured or the OAuth callback fails validation
- **THEN** the service rejects the flow without creating an authenticated session

#### Scenario: Provider email is not verified
- **WHEN** a provider cannot attest that its returned email is verified
- **THEN** the service does not grant an authenticated session until that email has been verified

### Requirement: Keep identity independent of profile data
The auth service SHALL own identity, credentials, and sessions only; creating an identity SHALL NOT automatically create or modify a business profile.

#### Scenario: Signup without profile
- **WHEN** an identity is registered or verified
- **THEN** the auth operation succeeds independently of the availability or existence of a profile service

### Requirement: Preserve identity identifiers across storage standardization
The auth service SHALL keep the identifier it issues for an existing identity byte-for-byte unchanged across the physical schema naming and identifier-strategy standardization, so that downstream services and clients that stored the previously issued value continue to resolve the same identity.

#### Scenario: Previously issued identity identifier still resolves
- **WHEN** an identity created before the standardization is presented to auth by its previously issued userId
- **THEN** the service resolves the same identity, returns that same userId value, and does not create a replacement identity

#### Scenario: New identity follows the documented identifier strategy
- **WHEN** a new identity is registered after the standardization
- **THEN** the service issues a userId in canonical UUID format, stored in the existing string column, and exposes it as an opaque non-empty string through the unchanged public field

#### Scenario: Legacy and new identifiers coexist
- **WHEN** identities issued before the standardization (with non-UUID random string ids) and identities registered after it are both used
- **THEN** the service resolves each by its own identifier value without requiring a format conversion, and neither the storage type nor existing values change

#### Scenario: Existing identifier is not reinterpreted as another type
- **WHEN** an identity issued under the prior strategy is looked up after the standardization
- **THEN** the service continues to accept and return its original identifier value without requiring the caller to convert or re-encode it

### Requirement: Preserve active sessions across storage standardization
The auth service SHALL keep existing browser sessions valid across the physical naming and identifier standardization; a session issued before the change SHALL continue to authenticate after it without requiring re-login.

#### Scenario: Pre-existing session remains usable
- **WHEN** an authenticated client holds a session issued before the standardization and calls a protected route after it
- **THEN** the route receives the same userId as before and the request is authorized

#### Scenario: Pre-existing session refresh remains usable
- **WHEN** an authenticated client with a pre-existing session requests a session refresh after the standardization
- **THEN** the session remains usable and the same logged-in identity is reported through the existing public response field names

### Requirement: Preserve the public auth contract
The auth service SHALL expose the same public field names and value types for identity and session operations after the standardization; physical storage identifiers SHALL NOT leak into the public HTTP contract or into Better Auth's canonical API object names.

#### Scenario: Signup response contract unchanged
- **WHEN** a client submits a valid email and password to `POST /auth/signup`
- **THEN** the service returns the identity identifier and pending-verification status under the same public field names and value types as before the standardization

#### Scenario: Session validation response contract unchanged
- **WHEN** a protected route receives a valid session after the standardization
- **THEN** it receives the authenticated userId under the same public name as before, and no physical table, column, index, or constraint name appears in the response
