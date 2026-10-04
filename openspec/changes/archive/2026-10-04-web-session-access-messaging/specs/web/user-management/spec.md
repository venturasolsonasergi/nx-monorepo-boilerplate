# Spec Delta

## MODIFIED Requirements

### Requirement: Gate profile creation behind a verified session
The `/users` route SHALL render the profile form only when the session check reports an active, verified session. While the check is pending it SHALL show a loading indicator; when no session is active it SHALL show an explanatory message that sign-in with a verified email is required and SHALL NOT attempt `POST /users`.

#### Scenario: Session check is pending
- **WHEN** the `/users` route mounts and the session check has not resolved
- **THEN** the page shows a loading indicator instead of the form

#### Scenario: No active session
- **WHEN** the session check reports no active session
- **THEN** the page explains that sign-in with a verified email is required, does not present the verification-result route as a way to sign in, and sends no `POST /users` request

#### Scenario: Active session
- **WHEN** the session check reports an active session
- **THEN** the page shows the profile creation form