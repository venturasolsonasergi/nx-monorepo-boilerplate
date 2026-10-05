# Spec: User Profile Retrieval

## Purpose
Let the authenticated caller read back the business profile linked to their own identity, so a logged-in client can display the existing profile instead of always presenting the creation flow.

## Requirements

### Requirement: Retrieve the authenticated caller's own profile
The users service SHALL return the profile linked to the caller's session-derived identity for `GET /users/me`, using only the identity resolved from the active session and never an identifier supplied by the caller.

#### Scenario: Identity with a profile
- **WHEN** a caller with an active session whose identity owns a profile requests `GET /users/me`
- **THEN** the service returns `200` with that profile's `id`, `authUserId`, `name`, `surname`, `address`, and `phone`

#### Scenario: Identity without a profile
- **WHEN** a caller with an active session whose identity does not own a profile requests `GET /users/me`
- **THEN** the service returns `404` and no profile data

#### Scenario: Missing or invalid session
- **WHEN** a client requests `GET /users/me` without a valid session
- **THEN** the service returns `401` without exposing any profile data

### Requirement: Isolate retrieved profiles by identity
The users service SHALL only ever return the profile owned by the caller's session-derived identity and SHALL NOT let a client-supplied identifier, query parameter, or request body select a different identity's profile.

#### Scenario: A different identity's profile is not returned
- **WHEN** identity A owns a profile and identity B, which has no profile, requests `GET /users/me` with its own valid session
- **THEN** B receives `404` and never identity A's profile data

#### Scenario: Caller-supplied identifier is ignored
- **WHEN** a caller includes an identifier for another identity in the request to `GET /users/me`
- **THEN** the service still resolves the profile solely from the session identity

### Requirement: Authorize profile retrieval by session only
The users service SHALL authorize `GET /users/me` with an active session and SHALL NOT require an additional email-verification check for this read; profile creation keeps its existing email-verification requirement.

#### Scenario: Active unverified session is not rejected for verification
- **WHEN** a caller with an active session whose identity is not marked email-verified requests `GET /users/me`
- **THEN** the service responds based on profile existence (`200` or `404`) and does not return `403`

### Requirement: Preserve the public users contract
The users service SHALL expose `GET /users/me` using the same public field names and value types as the existing profile response; physical storage identifiers SHALL NOT leak into the response.

#### Scenario: Response shape matches the profile contract
- **WHEN** a caller with an active session retrieves an existing profile from `GET /users/me`
- **THEN** the response uses the `id`, `authUserId`, `name`, `surname`, `address`, and `phone` public field names and value types, and no physical table, column, index, or constraint name appears
