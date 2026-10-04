# Spec Delta

## Purpose

Define how the browser client surfaces failed or invalid states so that failed API calls and missing sessions degrade to inline, recoverable messages instead of blank or broken screens.

## ADDED Requirements

### Requirement: Reject failed browser API responses
The browser API client SHALL send requests with credentials, SHALL reject any non-2xx response as an error that does not carry response data, and SHALL validate a successful response before it reaches route or feature code.

#### Scenario: Non-success response
- **WHEN** a browser request receives a response with a non-2xx status
- **THEN** the client rejects with an error that exposes the status and no route or feature receives unvalidated data

#### Scenario: Unusable success payload
- **WHEN** a browser request receives a success response whose body does not match the expected shape
- **THEN** the client rejects instead of passing the malformed payload to route or feature code

### Requirement: Present recoverable inline error states
Routes SHALL render failed or invalid states as inline messages within the page rather than navigating away or rendering an empty screen, and SHALL keep a recovery link available where a next step exists.

#### Scenario: Failed password reset submission
- **WHEN** a password reset submission fails
- **THEN** the page shows the failure inline and keeps the page usable

#### Scenario: Missing session on a profile page
- **WHEN** the profile page cannot confirm an active session
- **THEN** the page shows an inline explanatory state instead of an empty screen
