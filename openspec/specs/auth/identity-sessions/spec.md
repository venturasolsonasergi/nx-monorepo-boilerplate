# Spec: Identity Sessions

## Purpose

Provide a single authoritative identity and browser-session contract for registering, verifying, authenticating, and recovering accounts without owning business profile data.

## Requirements

### Requirement: Register an identity pending email verification
The auth service SHALL register a new identity with a valid, unique email and password, return its userId and a pending-verification status, and SHALL NOT issue a session until verification.

#### Scenario: Successful signup
- **WHEN** a client submits a valid email and password to `POST /auth/signup`
- **THEN** the service returns `201` with userId and pending-verification status, sends a verification link or token to that email, and does not set an authenticated session cookie

#### Scenario: Duplicate or invalid signup
- **WHEN** the email is already registered or the signup data is invalid
- **THEN** the service rejects the request without creating another identity or session, using `409` for an existing email and `400` for invalid input

### Requirement: Verify an email address
The auth service SHALL accept a valid, unexpired verification token and mark only its associated identity's email as verified. Reusing a still-valid token for an already-verified identity SHALL succeed idempotently without creating a session.

#### Scenario: Valid verification token
- **WHEN** a client submits a valid verification token to `POST /auth/verify-email`
- **THEN** the service marks that identity's email as verified and returns success without creating a session

#### Scenario: Reused verification token
- **WHEN** a client submits a still-valid verification token again after its identity has already been verified
- **THEN** the service returns success without changing the identity's verification state or creating a session

#### Scenario: Invalid or expired verification token
- **WHEN** a client submits an invalid or expired verification token
- **THEN** the service rejects the request without changing the identity's verification state

### Requirement: Log in with verified credentials
The auth service SHALL issue a browser session for valid email/password credentials only when the identity's email is verified; session cookies SHALL be HTTP-only and protected in production transport.

#### Scenario: Verified identity logs in
- **WHEN** a verified identity submits valid credentials to `POST /auth/login`
- **THEN** the service returns success and sets an authenticated session cookie

#### Scenario: Unverified or invalid credentials
- **WHEN** an unverified identity or a client with invalid credentials attempts login
- **THEN** the service does not create a session and returns an authentication error without revealing whether the email is registered

### Requirement: Validate and end browser sessions
The auth service SHALL reject missing, invalid, revoked, or expired sessions, expose the authenticated userId for authorized requests, and revoke the active session on logout.

#### Scenario: Valid session on protected route
- **WHEN** a client calls a protected route with an active session cookie
- **THEN** the route receives the session's userId as its authenticated identity

#### Scenario: Invalid or missing session
- **WHEN** a client calls a protected route without an active session
- **THEN** the route returns `401` without exposing protected data

#### Scenario: Logout
- **WHEN** an authenticated client calls `POST /auth/logout`
- **THEN** the current session is revoked and its cookie is cleared; subsequent use of that session is rejected

### Requirement: Renew an active browser session
The auth service SHALL renew an active session through `POST /auth/refresh` within the configured session policy, without requiring a separate browser-visible refresh token.

#### Scenario: Refresh an active session
- **WHEN** an authenticated client requests a session refresh
- **THEN** the session remains usable and any replacement cookie is delivered in the response

#### Scenario: Refresh an expired or revoked session
- **WHEN** a client attempts to refresh an expired, revoked, or absent session
- **THEN** the service returns `401` and does not issue a new session

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
