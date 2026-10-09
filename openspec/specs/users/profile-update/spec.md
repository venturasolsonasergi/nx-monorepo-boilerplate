# users/profile-update Specification

## Purpose

Let the authenticated caller update the business profile fields linked to their own identity, so a signed-in client can correct name, surname, address, and phone without recreating the profile.

## Requirements

### Requirement: Update the authenticated caller's own profile
The users service SHALL accept `PATCH /users/me` from a caller with an active session, SHALL apply the submitted name, surname, address, and phone values to the profile linked to the caller's session-derived identity, and SHALL return `200` with the updated profile's `id`, `authUserId`, `name`, `surname`, `address`, and `phone`. The endpoint SHALL use only the identity resolved from the active session and SHALL NOT require an additional email-verification check for this update. A caller without a valid session SHALL receive `401`, and a caller whose identity owns no profile SHALL receive `404` without creating one.

#### Scenario: Profile updated
- **WHEN** a caller with an active session submits valid profile fields to `PATCH /users/me`
- **THEN** the service persists the submitted values on that identity's profile and returns `200` with the updated public profile fields

#### Scenario: Update is visible to later reads
- **WHEN** a caller updates the profile and later requests `GET /users/me`
- **THEN** the read returns the updated values

#### Scenario: No profile to update
- **WHEN** a caller with an active session whose identity owns no profile submits `PATCH /users/me`
- **THEN** the service returns `404`, persists no profile, and leaves creation as the only path

#### Scenario: Missing or invalid session
- **WHEN** a client submits `PATCH /users/me` without a valid session
- **THEN** the service returns `401` and persists nothing

### Requirement: Validate profile updates
The users service SHALL reject a profile update with `400` and validation details identifying each offending field when a required field is missing or empty after trimming, or when an email, an identity identifier, or another unrecognized property is supplied. A rejected request SHALL NOT modify the profile.

#### Scenario: Empty or missing field is rejected
- **WHEN** a caller submits an update with an empty or missing required field
- **THEN** the service returns `400` with validation details identifying the field and the profile is unchanged

#### Scenario: Identity data or unrecognized field is rejected
- **WHEN** a caller submits an update including an email, an `authUserId`, or another unrecognized property
- **THEN** the service returns `400` with validation details and does not modify identity or profile data

### Requirement: Isolate profile updates by identity
The users service SHALL only ever update the profile owned by the caller's session-derived identity and SHALL NOT let a client-supplied identifier, query parameter, or request body select or modify a different identity's profile.

#### Scenario: Caller-supplied identifier is ignored
- **WHEN** a caller includes an identifier for another identity in a `PATCH /users/me` request
- **THEN** the service still resolves the profile solely from the session identity and never modifies another identity's profile

### Requirement: Preserve the public users contract for updates
The users service SHALL expose `PATCH /users/me` using the same public field names and value types as the existing profile response; physical storage identifiers SHALL NOT leak into the response.

#### Scenario: Response shape matches the profile contract
- **WHEN** a caller with an active session updates the profile
- **THEN** the response uses the `id`, `authUserId`, `name`, `surname`, `address`, and `phone` public field names and value types, and no physical table, column, index, or constraint name appears
