# Spec Delta

## ADDED Requirements

### Requirement: Preserve profile-to-identity links across storage standardization
The users service SHALL keep each existing profile linked to the same auth identity identifier across the physical schema naming standardization, and SHALL continue to resolve a profile by the identifier value auth issues for that identity.

#### Scenario: Existing profile remains linked after standardization
- **WHEN** the owner of a profile created before the standardization calls `POST /users` after it
- **THEN** the service still matches the caller's identity identifier to the existing profile and returns `409` rather than creating a duplicate

#### Scenario: Identity identifier remains an opaque string
- **WHEN** a caller whose identity identifier was issued before the standardization (a non-UUID string) or one issued after it (a UUID-format string) creates or is matched to a profile
- **THEN** the service stores and compares that identifier as an opaque non-empty string without assuming a UUID or numeric shape

### Requirement: Preserve the public users contract
The users service SHALL expose the same public request and response field names and value types for profile operations after the standardization; physical storage identifiers SHALL NOT leak into the public contract.

#### Scenario: Profile creation response unchanged
- **WHEN** an authenticated, email-verified caller submits valid profile fields to `POST /users`
- **THEN** the response exposes the profile's public `id` and `authUserId` field names and value types exactly as before the standardization

#### Scenario: Profile validation and conflict behavior unchanged
- **WHEN** a caller submits invalid profile fields, or an identity that already owns a profile resubmits
- **THEN** the service still returns the same `400` validation details or `409` conflict as before the standardization, and no physical table, column, index, or constraint name appears in the response
