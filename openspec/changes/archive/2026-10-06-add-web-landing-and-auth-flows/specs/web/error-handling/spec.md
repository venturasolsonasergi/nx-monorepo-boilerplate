# Spec Delta

## MODIFIED Requirements

### Requirement: Present recoverable inline error states

Routes SHALL render failed or invalid states as inline messages within the page
rather than navigating away or rendering an empty screen, and SHALL keep a
recovery action available where a next step exists. Validation failures, invalid
credentials, an expired or invalid link, a failed session check, and network
failures SHALL each surface as their own inline state. A failed session check or
a network failure SHALL NOT be presented as the caller being signed out, and a
network failure SHALL NOT be presented as an invalid-credentials or
invalid-link outcome.

#### Scenario: Failed password reset submission
- **WHEN** a password reset submission fails
- **THEN** the page shows the failure inline and keeps the page usable

#### Scenario: Missing session on a profile page
- **WHEN** the profile page cannot confirm an active session
- **THEN** the page shows an inline explanatory state instead of an empty screen

#### Scenario: Network failure is not a sign-out
- **WHEN** a session check or a form submission fails with a network error
- **THEN** the page shows a recoverable inline state and does not present the caller as signed out or as the owner of invalid credentials

#### Scenario: Distinct failure reasons
- **WHEN** a request fails because of validation, invalid credentials, or an expired or invalid link
- **THEN** the page shows a message specific to that reason rather than a single generic error
