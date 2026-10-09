# Spec Delta

## Purpose

Give the browser's `/settings` route an account security section: display the session email and the password's last modification time, offer a change-password dialog with the shared rule checklist and a revocation consent step, and keep the calling device signed in while every other device is signed out.

## ADDED Requirements

### Requirement: Present the account security section on settings
When the `/settings` route renders for an authenticated caller, it SHALL request `GET /auth/account` and present an account security section showing the session email. When the account summary reports a password credential, the section SHALL also show when the password was last modified and a control that opens the change-password dialog. When the account summary reports no password credential, the section SHALL show the email but SHALL NOT present a password change entry point. While the account request is pending the section SHALL show a loading state. When the account request fails with `401` the client SHALL treat the session as expired, clear visible private data, and offer a link to `/login` instead of the section. When the request fails without a definitive answer the section SHALL show a recoverable inline state rather than fabricated account data.

#### Scenario: Account section with a password credential
- **WHEN** the authenticated settings page loads and `GET /auth/account` returns `hasPassword: true` with a `passwordUpdatedAt`
- **THEN** the section shows the session email, the password's last modification time, and the change-password control

#### Scenario: Account section without a password credential
- **WHEN** `GET /auth/account` returns `hasPassword: false`
- **THEN** the section shows the session email and no password change entry point

#### Scenario: Session expires before the account read
- **WHEN** `GET /auth/account` returns `401`
- **THEN** the client clears visible private data, presents the signed-out state with a link to `/login`, and shows no account section

#### Scenario: Account read fails without a definitive answer
- **WHEN** `GET /auth/account` fails with a network error or a non-`401` response
- **THEN** the section shows a recoverable inline state and does not invent or hide the caller's email as if it were definitive

### Requirement: Present the change-password dialog
Activating the change-password control SHALL open a dialog with a current-password field, a new-password field, each with an accessible label and a show/hide control, and the rule checklist for the new password. The checklist SHALL list the password policy rules and SHALL mark each requirement rule met or unmet as the user types, showing the maximum-length limit neutrally until it is exceeded (then marked unmet, listed last). The dialog SHALL present a consent statement in the active locale that the change signs the caller out on every other device and that the current device stays signed in, with a checkbox the caller must mark before submission. The submit control SHALL be disabled while the current password is empty, while any policy rule is unmet, while the consent checkbox is unmarked, or while a submission is in flight.

#### Scenario: Checklist reflects the typed password
- **WHEN** the user types a new password that satisfies some but not all policy rules
- **THEN** each satisfied rule is marked met and each unsatisfied rule remains marked unmet before any submission

#### Scenario: Submission is gated
- **WHEN** the current password is empty, any rule is unmet, or the consent checkbox is unmarked
- **THEN** the submit control cannot start a request to `POST /auth/password/change`

#### Scenario: Consent statement is shown
- **WHEN** the change-password dialog is open
- **THEN** the dialog shows, in the active locale, that the change signs the caller out on every other device and that the current device stays signed in

#### Scenario: Fields can be shown or hidden
- **WHEN** the user toggles either password field's visibility control
- **THEN** that field switches between masked and visible without changing its value

### Requirement: Handle the change-password outcomes
The dialog SHALL submit the current and new passwords to `POST /auth/password/change` with credentials included. On success the client SHALL keep the caller authenticated on the current device, refresh the account summary so the password's last modification time is current, and close the dialog with a confirmation without navigating away. A `400` SHALL show an inline message next to the field it identifies: an incorrect current password next to the current-password field, unmet policy rules next to the new-password field. A `429` SHALL show a waiting state. Rate-limit, network, or service failures SHALL show a recoverable inline message and SHALL NOT close the dialog or present the change as successful or the caller as signed out.

#### Scenario: Successful change keeps this device signed in
- **WHEN** `POST /auth/password/change` succeeds
- **THEN** the caller remains authenticated on the current device, the account summary refreshes to the new last-modified time, the dialog closes with a confirmation, and the browser stays on `/settings`

#### Scenario: Incorrect current password
- **WHEN** the endpoint returns `400` identifying the current password
- **THEN** the dialog stays open and shows the error inline at the current-password field without marking the change successful

#### Scenario: Policy rejection from the server
- **WHEN** the endpoint returns `400` identifying unmet password rules
- **THEN** the dialog stays open and the new-password feedback reflects the unmet rules without claiming success

#### Scenario: Change fails without a definitive answer
- **WHEN** the endpoint returns `429` or fails with a network or service error
- **THEN** the dialog shows a recoverable inline message, remains open, and does not sign the caller out or claim the password changed
