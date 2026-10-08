# Spec Delta

## MODIFIED Requirements

### Requirement: Gate profile creation behind a verified session
The `/settings` route SHALL resolve the session before rendering its content. While the session check is pending it SHALL show a loading indicator. When the session check reports no active session it SHALL show an explanatory message that sign-in with a verified email is required, SHALL offer a link to `/login`, and SHALL NOT attempt `GET /users/me` or `POST /users`. When the session check fails without a definitive answer it SHALL show a recoverable inline state instead of the unauthenticated state.

#### Scenario: Session check is pending
- **WHEN** the `/settings` route mounts and the session check has not resolved
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
The account settings page SHALL present a profile form that collects non-empty name, surname, address, and phone values, each marked required, together with a language preference pre-selected to the active locale. On submit it SHALL first request `PATCH /users/me/settings` with the selected language and then request `POST /users` with the profile fields, and SHALL treat a `409` from `POST /users` as an already-created profile and continue instead of reporting an error. The submit control SHALL be disabled while requests are in flight and the profile fields SHALL be cleared once a submission is dispatched.

#### Scenario: Complete profile submitted
- **WHEN** the user fills all four required fields with non-empty values and submits the form
- **THEN** the client sends `PATCH /users/me/settings` with the selected language followed by `POST /users` with the profile fields, and clears the form fields

#### Scenario: Language defaults to the active locale
- **WHEN** the form is first presented while the active locale is `ca`
- **THEN** the language preference is pre-selected to `ca` and remains editable before submission

#### Scenario: Changed language is submitted
- **WHEN** the user changes the language preference to a supported locale and submits the form
- **THEN** the client persists that locale with `PATCH /users/me/settings` before creating the profile

#### Scenario: Required field empty
- **WHEN** the user attempts to submit with a required field left empty
- **THEN** the browser blocks submission and neither `PATCH /users/me/settings` nor `POST /users` is sent

#### Scenario: Submission in flight
- **WHEN** a profile submission has been dispatched and has not resolved
- **THEN** the submit control is disabled and shows an in-progress label

#### Scenario: Profile already exists
- **WHEN** `POST /users` returns `409` because the identity already owns a profile
- **THEN** the client continues without reporting an error and presents the existing profile

### Requirement: Display the authenticated caller's existing profile
The `/settings` route SHALL render inside the application shell (the same sidebar and shell chrome as `/dashboard`). When a session is active, the `/settings` route SHALL request `GET /users/me`. When the service returns `200` it SHALL display the returned profile's name, surname, address, and phone values and a language preference section (with a title, an explanatory description, and a selector offering `es`, `en`, and `ca`) and SHALL NOT present the profile-creation form, unless the route was opened with an authorized `returnTo` destination, in which case it SHALL continue to that destination. When the service returns `404` it SHALL present the profile-creation form. When the service returns `401` (for example a session that expires between the session check and the profile read) it SHALL clear any visible private data, update the session state to unauthenticated, offer a link to `/login`, and SHALL NOT present the creation form. When the request fails without a definitive answer it SHALL show a recoverable inline state and SHALL NOT present the creation form as though no profile existed. After a `POST /users` creation succeeds, when the route was opened with an authorized `returnTo` destination it SHALL continue to that destination, and otherwise it SHALL display the created profile instead of the empty form. The client SHALL accept only the exact value `/dashboard` as an authorized destination; any other value, including an external URL, a protocol-relative host, or a different internal route, SHALL be discarded and the default behavior SHALL be used.

#### Scenario: The profile page renders inside the workspace shell
- **WHEN** the browser opens `/settings`
- **THEN** the page renders inside the application shell and does not render the public header

#### Scenario: Profile exists
- **WHEN** `GET /users/me` returns `200` without an authorized `returnTo` destination
- **THEN** the page displays the profile's name, surname, address, and phone, and the current language preference, and does not render the creation form

#### Scenario: Language preference section is presented
- **WHEN** `GET /users/me` returns `200` without an authorized `returnTo` destination
- **THEN** the page shows a language section with a title, an explanatory description, and a selector offering `es`, `en`, and `ca`

#### Scenario: Existing profile continues to an authorized destination
- **WHEN** the route was opened with `returnTo=%2Fdashboard` and `GET /users/me` returns `200`
- **THEN** the client continues to `/dashboard`

#### Scenario: Profile does not exist
- **WHEN** `GET /users/me` returns `404`
- **THEN** the page renders the profile-creation form with the language preference pre-selected to the active locale

#### Scenario: Session expires before the profile read
- **WHEN** `GET /users/me` returns `401`
- **THEN** the page clears any visible private data, updates the session state, offers a link to `/login`, and does not render the creation form

#### Scenario: Profile retrieval fails without a definitive answer
- **WHEN** `GET /users/me` fails with a network error or a non-`401`, non-`404` response
- **THEN** the page shows a recoverable inline state rather than the creation form

#### Scenario: Profile appears after creation
- **WHEN** the user completes the creation form, `POST /users` succeeds, and the route was not opened with an authorized `returnTo` destination
- **THEN** the page displays the created profile instead of the empty form

#### Scenario: Created profile continues to an authorized destination
- **WHEN** the route was opened with `returnTo=%2Fdashboard`, the user completes the creation form, and `POST /users` succeeds
- **THEN** the client continues to `/dashboard`

#### Scenario: Unauthorized destination is ignored
- **WHEN** the route was opened with a `returnTo` that is not exactly `/dashboard`
- **THEN** the client discards it and keeps the default behavior for the returned or created profile
