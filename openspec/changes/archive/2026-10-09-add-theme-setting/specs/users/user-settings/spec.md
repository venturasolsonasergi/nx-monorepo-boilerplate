# Spec Delta

## MODIFIED Requirements

### Requirement: Retrieve the caller's own settings
The users service SHALL return the settings owned by the caller's session-derived identity for `GET /users/me/settings`, using only the identity resolved from the active session and never an identifier supplied by the caller.

#### Scenario: Identity with stored settings
- **WHEN** a caller with an active session whose identity owns settings requests `GET /users/me/settings`
- **THEN** the service returns `200` with the stored `language` and `theme`

#### Scenario: Identity without stored settings
- **WHEN** a caller with an active session whose identity has no settings requests `GET /users/me/settings`
- **THEN** the service returns `404` and no settings data

#### Scenario: Missing or invalid session
- **WHEN** a client requests `GET /users/me/settings` without a valid session
- **THEN** the service returns `401` without exposing any settings data

### Requirement: Partially update the caller's own settings
The users service SHALL apply `PATCH /users/me/settings` to the caller's session-derived identity, updating only the fields present in the request and creating the settings when none exist, and SHALL return the resulting settings.

#### Scenario: First write creates settings
- **WHEN** an identity with no settings submits a supported `language` to `PATCH /users/me/settings`
- **THEN** the service creates the identity's settings and returns `200` with the stored `language` and the default `theme`

#### Scenario: Settings created without a theme default to system
- **WHEN** an identity with no settings submits a request that omits `theme`
- **THEN** the created settings have `theme` set to `system`

#### Scenario: Update changes only the provided field
- **WHEN** an identity with existing settings submits a supported `language`
- **THEN** the service updates that field and returns `200` with the resulting settings

#### Scenario: Missing or invalid session
- **WHEN** a client submits `PATCH /users/me/settings` without a valid session
- **THEN** the service returns `401` and persists nothing

### Requirement: Preserve the public settings contract
The users service SHALL expose the settings with the public field names `language` and `theme`, each with a value drawn from its supported set; physical storage identifiers SHALL NOT leak into the response.

#### Scenario: Response shape matches the settings contract
- **WHEN** a caller with an active session retrieves or updates settings
- **THEN** the response exposes a `language` field with a supported language value and a `theme` field with `light`, `dark`, or `system`, and no physical table, column, index, or constraint name appears

## ADDED Requirements

### Requirement: Validate the theme against the supported set
The users service SHALL reject a settings update whose `theme` is not one of `light`, `dark`, and `system` with `400` and SHALL NOT persist the change.

#### Scenario: Unsupported theme rejected
- **WHEN** a caller submits a `theme` outside `light`, `dark`, and `system` to `PATCH /users/me/settings`
- **THEN** the service returns `400` with validation details and stores no settings

#### Scenario: Supported themes accepted
- **WHEN** a caller submits each of `light`, `dark`, and `system` in separate valid updates
- **THEN** the service persists each value and returns `200` with the resulting settings
