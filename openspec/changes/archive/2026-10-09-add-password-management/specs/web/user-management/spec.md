# Spec Delta

## MODIFIED Requirements

### Requirement: Display the authenticated caller's existing profile
The `/settings` route SHALL render inside the application shell (the same sidebar and shell chrome as `/dashboard`). When a session is active, the `/settings` route SHALL request `GET /users/me`. When the service returns `200` it SHALL display the returned profile's name, surname, address, and phone values and a language preference section (with a title, an explanatory description, and a selector offering `es`, `en`, and `ca`), SHALL offer an edit control that swaps the profile display for a profile form pre-filled with the current values, SHALL submit an edited profile to `PATCH /users/me` where a successful update SHALL display the updated values in place of the form and cancelling SHALL return to the profile display without changes, and SHALL NOT present the profile-creation form, unless the route was opened with an authorized `returnTo` destination, in which case it SHALL continue to that destination. When the service returns `404` it SHALL present the profile-creation form. When the service returns `401` (for example a session that expires between the session check and the profile read) it SHALL clear any visible private data, update the session state to unauthenticated, offer a link to `/login`, and SHALL NOT present the creation form. When the request fails without a definitive answer it SHALL show a recoverable inline state and SHALL NOT present the creation form as though no profile existed. After a `POST /users` creation succeeds, when the route was opened with an authorized `returnTo` destination it SHALL continue to that destination, and otherwise it SHALL display the created profile instead of the empty form. The client SHALL accept only the exact value `/dashboard` as an authorized destination; any other value, including an external URL, a protocol-relative host, or a different internal route, SHALL be discarded and the default behavior SHALL be used.

#### Scenario: The profile page renders inside the workspace shell
- **WHEN** the browser opens `/settings`
- **THEN** the page renders inside the application shell and does not render the public header

#### Scenario: Profile exists
- **WHEN** `GET /users/me` returns `200` without an authorized `returnTo` destination
- **THEN** the page displays the profile's name, surname, address, and phone, and the current language preference, and does not render the creation form

#### Scenario: Language preference section is presented
- **WHEN** `GET /users/me` returns `200` without an authorized `returnTo` destination
- **THEN** the page shows a language section with a title, an explanatory description, and a selector offering `es`, `en`, and `ca`

#### Scenario: Edit opens the pre-filled form
- **WHEN** the owner activates the edit control on the displayed profile
- **THEN** the profile display is replaced by a profile form pre-filled with the current name, surname, address, and phone values, and no creation form is presented

#### Scenario: Successful update is reflected
- **WHEN** the owner submits the pre-filled form with valid edited values and `PATCH /users/me` succeeds
- **THEN** the page displays the updated values in place of the form and does not claim or render a created profile

#### Scenario: Cancel discards edits
- **WHEN** the owner cancels the edit form after changing field values
- **THEN** the page returns to the profile display showing the stored values, submits no request, and loses no visible profile data

#### Scenario: Update rejected by validation
- **WHEN** `PATCH /users/me` returns `400` identifying invalid fields
- **THEN** the form remains open with inline validation errors, no success is shown, and the stored profile is unchanged

#### Scenario: Update fails without a definitive answer
- **WHEN** `PATCH /users/me` fails with a network error or a non-`400`, non-`401` response
- **THEN** the page shows a recoverable inline message without claiming success and without presenting the creation form

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
