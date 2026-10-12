# Spec Delta: auth/password-management

## MODIFIED Requirements

### Requirement: Disclose the account summary to the session identity
The auth service SHALL expose `GET /auth/account` for the caller's session-derived identity, returning the identity's `email`, the display name recorded for that identity by the authentication provider (`name`), whether a password credential exists (`hasPassword`), and the time the current password was established or last changed (`passwordUpdatedAt`). `name` SHALL be the display name established at identity creation or by a later provider sign-in, and MAY be absent (null) when no display name is recorded. The endpoint SHALL use only the identity resolved from the active valid verified session and SHALL return `401` without data when the session is missing, invalid, revoked, expired, or unverified. No physical storage identifier SHALL leak into the response.

#### Scenario: Authenticated account summary
- **WHEN** a caller with a valid verified session requests `GET /auth/account`
- **THEN** the service returns `200` with that identity's `email`, `name`, `hasPassword`, and `passwordUpdatedAt`

#### Scenario: Identity without a password credential
- **WHEN** an identity without a password credential requests `GET /auth/account`
- **THEN** the service returns `200` with `hasPassword: false` and a null `passwordUpdatedAt`, and never another identity's data

#### Scenario: Identity without a recorded display name
- **WHEN** an identity for which the provider recorded no display name requests `GET /auth/account`
- **THEN** the service returns `200` with a null `name` and the remaining summary fields

#### Scenario: Unauthenticated account summary
- **WHEN** `GET /auth/account` is requested without a valid verified session
- **THEN** the service returns `401` without exposing any account data

#### Scenario: Summary reflects a password change
- **WHEN** a caller changes the password successfully and later requests `GET /auth/account`
- **THEN** `passwordUpdatedAt` reports the time of the change
