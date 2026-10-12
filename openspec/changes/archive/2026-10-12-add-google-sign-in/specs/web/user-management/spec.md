# Spec Delta: web/user-management

## MODIFIED Requirements

### Requirement: Collect and submit required profile fields
The account settings page SHALL present a profile form that collects non-empty name, surname, address, and phone values, each marked required, together with a language preference pre-selected to the active locale. When the caller owns no profile, the form SHALL pre-fill its empty name and surname fields from the display name disclosed by `GET /auth/account`: the first whitespace-separated token SHALL fill the name field and the remaining tokens SHALL fill the surname field, leaving the surname empty when only one token exists; address and phone SHALL remain empty. The pre-fill SHALL only suggest values, SHALL never overwrite a field the caller has already filled, and SHALL NOT apply when a profile already exists. On submit it SHALL first request `PATCH /users/me/settings` with the selected language and then request `POST /users` with the profile fields, and SHALL treat a `409` from `POST /users` as an already-created profile and continue instead of reporting an error. The submit control SHALL be disabled while requests are in flight and the profile fields SHALL be cleared once a submission is dispatched.

#### Scenario: Complete profile submitted
- **WHEN** the user fills all four required fields with non-empty values and submits the form
- **THEN** the client sends `PATCH /users/me/settings` with the selected language followed by `POST /users` with the profile fields, and clears the form fields

#### Scenario: Language defaults to the active locale
- **WHEN** the form is first presented while the active locale is `ca`
- **THEN** the language preference is pre-selected to `ca` and remains editable before submission

#### Scenario: Creation form pre-fills from the provider display name
- **WHEN** the caller owns no profile and the account summary discloses the display name "Joan Pere Sila"
- **THEN** the name field is pre-filled with "Joan" and the surname field with "Pere Sila", both remaining editable

#### Scenario: Single-token display name leaves the surname empty
- **WHEN** the caller owns no profile and the disclosed display name consists of a single token
- **THEN** the name field is pre-filled with that token, the surname field starts empty, and address and phone remain empty

#### Scenario: Pre-fill never overwrites values the caller has already filled
- **WHEN** the creation form is presented with a name or surname the caller has already typed and a display name is disclosed
- **THEN** only the still-empty name or surname field is pre-filled and the typed value is preserved

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
