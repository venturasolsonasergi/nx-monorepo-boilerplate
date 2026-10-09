# Spec Delta

## Purpose

Let the authenticated identity manage its own password credential: a shared password policy enforced at every endpoint that establishes or replaces a password, an authenticated password change that revokes every other session of the identity while keeping the calling device signed in, and an account summary that discloses the session email and the password's last modification time.

## ADDED Requirements

### Requirement: Enforce the shared password policy at password entry points
The auth service SHALL reject with `400` and validation details any request that establishes or replaces a password credential with a password that does not satisfy the password policy: at least 12 characters, at most 128 characters, and containing at least one lowercase letter, one uppercase letter, one digit, and one special (non-alphanumeric) character. The policy SHALL apply to `POST /auth/signup/complete`, `POST /auth/reset-password/confirm`, and `POST /auth/password/change`. A rejected request SHALL NOT create, change, or consume any credential, registration, or token state. The response SHALL identify the offending field and which policy rules are unmet. The policy SHALL NOT be applied retroactively to existing credentials or to login.

#### Scenario: Conforming password accepted
- **WHEN** a password entry point receives a password with at least 12 characters including a lowercase letter, an uppercase letter, a digit, and a special character
- **THEN** the service processes the request under that endpoint's existing behavior

#### Scenario: Password missing a rule is rejected
- **WHEN** a password entry point receives a password that fails any policy rule (for example only 11 characters, or no uppercase letter)
- **THEN** the service returns `400` with validation details naming the password field and the unmet rules, and no credential or token state is created, changed, or consumed

#### Scenario: Policy is not applied retroactively
- **WHEN** an identity whose existing credential predates the policy logs in with that credential
- **THEN** the service authenticates the session as before and does not reject the stored password

### Requirement: Change the password with the current one
The auth service SHALL accept `POST /auth/password/change` from an authenticated caller with a valid verified session, requiring the current password and the new password. It SHALL verify the current password, replace the credential only on a match, and on success SHALL revoke every other active session of that identity while keeping the calling session active by issuing a rotated replacement session cookie. The response SHALL NOT return the session token in the body. A wrong current password SHALL return `400` identifying the current password field without revealing any other credential information. The endpoint SHALL reject a caller without a password credential (for example an OAuth-only identity) with `400`, and SHALL NOT create one. Missing, invalid, revoked, expired, or unverified sessions SHALL return `401`; rate limits SHALL return `429` with a retry interval; operational failures SHALL remain non-`401` recoverable errors.

#### Scenario: Password changed and every other session revoked
- **WHEN** an authenticated caller submits the correct current password and a policy-conforming new password to `POST /auth/password/change`
- **THEN** the credential is replaced, every other active session of that identity is revoked, the calling session is rotated with a replacement session cookie so the caller stays authenticated, and every other device must authenticate again with the new password

#### Scenario: Wrong current password
- **WHEN** an authenticated caller submits an incorrect current password
- **THEN** the service returns `400` identifying the current password as incorrect, the credential is unchanged, and the caller's session remains valid

#### Scenario: Identity without a password credential
- **WHEN** an authenticated identity without an existing password credential submits a password change
- **THEN** the service returns `400`, changes no credential, and revokes no session

#### Scenario: Unauthenticated caller
- **WHEN** `POST /auth/password/change` is submitted without a valid verified session
- **THEN** the service returns `401` and changes no credential

#### Scenario: Password change is rate limited or fails operationally
- **WHEN** the request exceeds the applicable rate limit or a dependency failure prevents the change
- **THEN** the service returns `429` with a retry interval or a recoverable non-`401` error, the credential is unchanged, and the session is not revoked solely because of that failure

### Requirement: Disclose the account summary to the session identity
The auth service SHALL expose `GET /auth/account` for the caller's session-derived identity, returning the identity's `email`, whether a password credential exists (`hasPassword`), and the time the current password was established or last changed (`passwordUpdatedAt`). The endpoint SHALL use only the identity resolved from the active valid verified session and SHALL return `401` without data when the session is missing, invalid, revoked, expired, or unverified. No physical storage identifier SHALL leak into the response.

#### Scenario: Authenticated account summary
- **WHEN** a caller with a valid verified session requests `GET /auth/account`
- **THEN** the service returns `200` with that identity's `email`, `hasPassword`, and `passwordUpdatedAt`

#### Scenario: Identity without a password credential
- **WHEN** an identity without a password credential requests `GET /auth/account`
- **THEN** the service returns `200` with `hasPassword: false` and a null `passwordUpdatedAt`, and never another identity's data

#### Scenario: Unauthenticated account summary
- **WHEN** `GET /auth/account` is requested without a valid verified session
- **THEN** the service returns `401` without exposing any account data

#### Scenario: Summary reflects a password change
- **WHEN** a caller changes the password successfully and later requests `GET /auth/account`
- **THEN** `passwordUpdatedAt` reports the time of the change
