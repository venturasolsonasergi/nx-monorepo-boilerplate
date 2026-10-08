# Spec Delta

## MODIFIED Requirements

### Requirement: Display the authenticated caller's existing profile
The `/users` route SHALL render inside the application shell (the same sidebar and shell chrome as `/dashboard`). When a session is active, the `/users` route SHALL request `GET /users/me`. When the service returns `200` it SHALL display the returned profile's name, surname, address, and phone values and SHALL NOT present the profile-creation form, unless the route was opened with an authorized `returnTo` destination, in which case it SHALL continue to that destination. When the service returns `404` it SHALL present the profile-creation form. When the service returns `401` (for example a session that expires between the session check and the profile read) it SHALL clear any visible private data, update the session state to unauthenticated, offer a link to `/login`, and SHALL NOT present the creation form. When the request fails without a definitive answer it SHALL show a recoverable inline state and SHALL NOT present the creation form as though no profile existed. After a `POST /users` creation succeeds, when the route was opened with an authorized `returnTo` destination it SHALL continue to that destination, and otherwise it SHALL display the created profile instead of the empty form. The client SHALL accept only the exact value `/dashboard` as an authorized destination; any other value, including an external URL, a protocol-relative host, or a different internal route, SHALL be discarded and the default behavior SHALL be used.

#### Scenario: The profile page renders inside the workspace shell
- **WHEN** the browser opens `/users`
- **THEN** the page renders inside the application shell and does not render the public header

#### Scenario: Profile exists
- **WHEN** `GET /users/me` returns `200` without an authorized `returnTo` destination
- **THEN** the page displays the profile's name, surname, address, and phone and does not render the creation form

#### Scenario: Existing profile continues to an authorized destination
- **WHEN** the route was opened with `returnTo=%2Fdashboard` and `GET /users/me` returns `200`
- **THEN** the client continues to `/dashboard`

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
- **WHEN** the user completes the creation form, `POST /users` succeeds, and the route was not opened with an authorized `returnTo` destination
- **THEN** the page displays the created profile instead of the empty form

#### Scenario: Created profile continues to an authorized destination
- **WHEN** the route was opened with `returnTo=%2Fdashboard`, the user completes the creation form, and `POST /users` succeeds
- **THEN** the client continues to `/dashboard`

#### Scenario: Unauthorized destination is ignored
- **WHEN** the route was opened with a `returnTo` that is not exactly `/dashboard`
- **THEN** the client discards it and keeps the default behavior for the returned or created profile
