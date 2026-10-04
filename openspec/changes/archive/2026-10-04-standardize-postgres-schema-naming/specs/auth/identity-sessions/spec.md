# Spec Delta

## ADDED Requirements

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
