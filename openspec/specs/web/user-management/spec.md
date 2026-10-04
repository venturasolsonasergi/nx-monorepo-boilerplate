# web/user-management Specification

## Purpose
Define how the browser client creates the authenticated caller's profile from the `/users` route, including required profile fields and session gating.

## Requirements

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

### Requirement: Collect and submit required profile fields
The profile form SHALL collect non-empty name, surname, address, and phone values, SHALL mark each field as required, and SHALL submit them to `POST /users`. The submit control SHALL be disabled while the request is in flight and SHALL clear the fields once a submission is dispatched.

#### Scenario: Complete profile submitted
- **WHEN** the user fills all four required fields with non-empty values and submits the form
- **THEN** the client sends `POST /users` with those values and clears the form fields

#### Scenario: Required field empty
- **WHEN** the user attempts to submit with a required field left empty
- **THEN** the browser blocks submission and no `POST /users` request is sent

#### Scenario: Submission in flight
- **WHEN** a profile submission has been dispatched and has not resolved
- **THEN** the submit control is disabled and shows an in-progress label
