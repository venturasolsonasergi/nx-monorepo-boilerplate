# web/user-management Specification

## Purpose
Define how the browser client creates the authenticated caller's profile from the `/users` route, including required profile fields and session gating.

## Requirements

### Requirement: Gate profile creation behind a verified session
The `/users` route SHALL resolve the session before rendering its content. While the session check is pending it SHALL show a loading indicator. When the session check reports no active session it SHALL show an explanatory message that sign-in with a verified email is required, SHALL offer a link to `/login`, and SHALL NOT attempt `GET /users/me` or `POST /users`. When the session check fails without a definitive answer it SHALL show a recoverable inline state instead of the unauthenticated state.

#### Scenario: Session check is pending
- **WHEN** the `/users` route mounts and the session check has not resolved
- **THEN** the page shows a loading indicator instead of form or profile content

#### Scenario: No active session
- **WHEN** the session check reports no active session
- **THEN** the page explains that sign-in with a verified email is required, offers a link to `/login`, and sends neither `GET /users/me` nor `POST /users`

#### Scenario: Session check fails without a definitive answer
- **WHEN** the session check fails with a network error or a non-`401` response
- **THEN** the page shows a recoverable inline state and does not present the caller as signed out

#### Scenario: Active session
- **WHEN** the session check reports an active session
- **THEN** the page proceeds to load the authenticated caller's profile

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

### Requirement: Display the authenticated caller's existing profile
When a session is active, the `/users` route SHALL request `GET /users/me`. When the service returns `200` it SHALL display the returned profile's name, surname, address, and phone values and SHALL NOT present the profile-creation form. When the service returns `404` it SHALL present the profile-creation form. When the service returns `401` (for example a session that expires between the session check and the profile read) it SHALL clear any visible private data, update the session state to unauthenticated, offer a link to `/login`, and SHALL NOT present the creation form. When the request fails without a definitive answer it SHALL show a recoverable inline state and SHALL NOT present the creation form as though no profile existed.

#### Scenario: Profile exists
- **WHEN** `GET /users/me` returns `200`
- **THEN** the page displays the profile's name, surname, address, and phone and does not render the creation form

#### Scenario: Profile does not exist
- **WHEN** `GET /users/me` returns `404`
- **THEN** the page renders the profile-creation form

#### Scenario: Session expires before the profile read
- **WHEN** `GET /users/me` returns `401`
- **THEN** the page clears any visible private data, updates the session state, offers a link to `/login`, and does not render the creation form

#### Scenario: Profile retrieval fails without a definitive answer
- **WHEN** `GET /users/me` fails with a network error or a non-`401`, non-`404` response
- **THEN** the page shows a recoverable inline state rather than the creation form

#### Scenario: Profile appears after creation
- **WHEN** the user completes the creation form and `POST /users` succeeds
- **THEN** the page displays the created profile instead of the empty form
