# users/user-settings Specification

## Purpose

Store and expose the authenticated identity's own user settings - the platform language for now, extensible to further preferences - independently of the business profile.

## Requirements

### Requirement: Retrieve the caller's own settings
The users service SHALL return the settings owned by the caller's session-derived identity for `GET /users/me/settings`, using only the identity resolved from the active session and never an identifier supplied by the caller.

#### Scenario: Identity with stored settings
- **WHEN** a caller with an active session whose identity owns settings requests `GET /users/me/settings`
- **THEN** the service returns `200` with the stored `language`

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
- **THEN** the service creates the identity's settings and returns `200` with the stored `language`

#### Scenario: Update changes only the provided field
- **WHEN** an identity with existing settings submits a supported `language`
- **THEN** the service updates that field and returns `200` with the resulting settings

#### Scenario: Missing or invalid session
- **WHEN** a client submits `PATCH /users/me/settings` without a valid session
- **THEN** the service returns `401` and persists nothing

### Requirement: Validate the language against the supported set
The users service SHALL reject a settings update whose `language` is not one of `es`, `en`, and `ca` with `400` and SHALL NOT persist the change.

#### Scenario: Unsupported language rejected
- **WHEN** a caller submits a `language` outside `es`, `en`, and `ca` to `PATCH /users/me/settings`
- **THEN** the service returns `400` with validation details and stores no settings

### Requirement: Isolate settings by identity
The users service SHALL only ever read or write the settings owned by the caller's session-derived identity and SHALL NOT let a client-supplied identifier, query parameter, or request body select or modify a different identity's settings.

#### Scenario: A different identity's settings are not returned
- **WHEN** identity A owns settings and identity B, which has none, requests `GET /users/me/settings` with its own valid session
- **THEN** B receives `404` and never identity A's settings

#### Scenario: A different identity's settings are not modified
- **WHEN** identity B submits `PATCH /users/me/settings` while including identity A's identifier
- **THEN** only B's settings are created or updated and A's settings are unchanged

### Requirement: Preserve the public settings contract
The users service SHALL expose the settings with the public field name `language` and a value drawn from the supported set; physical storage identifiers SHALL NOT leak into the response.

#### Scenario: Response shape matches the settings contract
- **WHEN** a caller with an active session retrieves or updates settings
- **THEN** the response exposes a `language` field with a supported value and no physical table, column, index, or constraint name appears
