# Spec: User Registration

## Purpose
Define the externally observable behavior for registering users through the users service.

## Requirements

### Requirement: Create a profile for the authenticated identity
The users service SHALL accept `POST /users` only for a caller with an active, email-verified identity and SHALL link the new profile to the caller's authenticated userId, never to a caller-supplied identity identifier.

#### Scenario: Successful profile creation
- **WHEN** an authenticated, email-verified caller submits non-empty name, surname, address, and phone values to `POST /users`
- **THEN** the service trims those values, persists one profile keyed by the caller's authenticated userId, and returns `201` with its positive integer profile id, authUserId, and normalized profile fields

#### Scenario: Missing session or unverified identity
- **WHEN** a client without an active session attempts profile creation, or the authenticated identity is not email-verified
- **THEN** the service rejects creation with `401` for a missing or invalid session, or `403` for an unverified identity, and persists no profile

### Requirement: Reject invalid profile details
The users service SHALL reject a profile creation request when a required field is missing or empty after trimming, or an unrecognized or identity-related field is supplied.

#### Scenario: Required profile field is missing
- **WHEN** a caller submits a profile without one or more required profile fields
- **THEN** the service returns `400` with validation details identifying each missing field

#### Scenario: Identity data or invalid profile field is supplied
- **WHEN** a caller submits an empty profile field, email, authUserId, or another unrecognized property
- **THEN** the service returns `400` with validation details and does not modify identity or profile data

### Requirement: One profile per authenticated identity
The users service SHALL prevent multiple profiles from being persisted for the same authUserId.

#### Scenario: Profile already exists
- **WHEN** an authenticated identity that already owns a profile calls `POST /users` again
- **THEN** the service returns `409` and does not create a second profile
