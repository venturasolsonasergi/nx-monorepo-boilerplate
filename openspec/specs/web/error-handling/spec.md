# web/error-handling Specification

## Purpose
Define how the browser client surfaces failed or invalid states so that failed API calls and missing sessions degrade to inline, recoverable messages instead of blank or broken screens.

## Requirements

### Requirement: Present recoverable inline error states
Routes SHALL render failed or invalid states as inline messages within the page rather than navigating away or rendering an empty screen, and SHALL keep a recovery link available where a next step exists.

#### Scenario: Failed password reset submission
- **WHEN** a password reset submission fails
- **THEN** the page shows the failure inline and keeps the page usable

#### Scenario: Missing session on a profile page
- **WHEN** the profile page cannot confirm an active session
- **THEN** the page shows an inline explanatory state instead of an empty screen
