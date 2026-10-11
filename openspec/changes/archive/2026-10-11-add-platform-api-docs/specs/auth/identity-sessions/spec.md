# Spec Delta

## MODIFIED Requirements

### Requirement: Verify an email address
The auth service SHALL complete email/password registration only when `POST /auth/signup/complete` receives a valid, unexpired, single-use registration token and a valid password. It SHALL bind the token to the current registration, establish the verified identity and credential with the submitted password, consume the token, and issue an authenticated HTTP-only session cookie on success. Identity and credential persistence and token consumption SHALL be atomic. `GET /auth/verify-email` SHALL only redirect to the approved web password-entry route and SHALL NOT consume a token, verify an identity, or create a session. Completion SHALL NOT create a business profile.

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
