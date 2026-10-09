# Spec Delta

## MODIFIED Requirements

### Requirement: Present the password reset flow
The `/reset-password` route SHALL read the `token` query parameter, SHALL refuse to render the reset form when the token is missing, and SHALL submit a new password to `POST /auth/reset-password/confirm`. It SHALL label the password field accessibly, SHALL present the password policy as a rule checklist on the new-password field that marks each requirement rule met or unmet as the user types and shows the maximum-length limit neutrally until it is exceeded, when it is marked unmet and listed last, SHALL refuse to submit a password that does not satisfy the policy, SHALL report success or failure inline, and SHALL offer a link to `/login` once the password has been updated. It SHALL distinguish an invalid or expired link (`400`) from a network failure and SHALL NOT present a network failure as an invalid link.

#### Scenario: Missing reset token
- **WHEN** the browser opens `/reset-password` without a `token` value
- **THEN** the page shows a missing-token message and does not render the password form

#### Scenario: Reset accepted
- **WHEN** the browser opens `/reset-password` with a token, the user submits a password that satisfies the password policy, and `POST /auth/reset-password/confirm` succeeds
- **THEN** the page replaces the form with a confirmation that the password was updated and offers a link to `/login`

#### Scenario: Checklist reflects the typed password
- **WHEN** the user types a new password in the reset form that satisfies some but not all policy rules
- **THEN** each satisfied rule is marked met and each unsatisfied rule remains marked unmet, and submission is refused until every rule is met

#### Scenario: Maximum-length limit is shown neutrally
- **WHEN** the user types a password whose length is within the maximum
- **THEN** the maximum-length limit is shown neutrally (not marked met) at the end of the checklist, and it is marked unmet only when the password exceeds the maximum length

#### Scenario: Reset rejected
- **WHEN** `POST /auth/reset-password/confirm` fails with `400` for a submitted token and password
- **THEN** the page shows an inline message that the link is invalid or expired and no confirmation is shown

#### Scenario: Reset fails without a definitive answer
- **WHEN** `POST /auth/reset-password/confirm` fails with a network error
- **THEN** the page shows a recoverable message that is not the invalid-link message and no confirmation is shown

### Requirement: Complete signup with a password
The `/complete-signup` route SHALL read the registration token supplied by the email return path and present a single password field with a show/hide control. It SHALL present the password policy as a rule checklist on the password field that marks each requirement rule met or unmet as the user types and shows the maximum-length limit neutrally until it is exceeded, when it is marked unmet and listed last, SHALL refuse to submit without a token or a password that satisfies the policy, and SHALL call `POST /auth/signup/complete` with credentials included. On authenticated success it SHALL update session state, clear previous private caches and token-bearing browser URLs, and navigate to `/settings` so the caller completes the profile in the same flow. Invalid, expired, superseded, or consumed tokens SHALL show a safe link error with a restart action. Rate limits and network/service failures SHALL show recoverable messages. If the API reports that activation committed but session issuance failed, the page SHALL offer normal login with the chosen password rather than another registration. No password or token SHALL be persisted in browser storage or logs.

#### Scenario: Missing token
- **WHEN** `/complete-signup` has no token
- **THEN** no completion can be submitted and the page offers a new signup

#### Scenario: Password can be shown or hidden
- **WHEN** the user toggles the password visibility control
- **THEN** the single password field switches between masked and visible without changing its value

#### Scenario: Checklist reflects the typed password
- **WHEN** the user types a password that satisfies some but not all policy rules
- **THEN** each satisfied rule is marked met and each unsatisfied rule remains marked unmet, and completion is refused until every rule is met

#### Scenario: Activation and authenticated continuation
- **WHEN** completion succeeds with the session cookie
- **THEN** session and private caches are updated, the token-bearing URL is replaced, and `/settings` presents the profile completion form for the authenticated caller

#### Scenario: Expired or unusable link
- **WHEN** completion rejects an expired, invalid, superseded, or consumed token
- **THEN** the page offers a new signup and does not claim activation or authentication

#### Scenario: Operational completion failure
- **WHEN** completion is rate limited or fails without a definitive activation result
- **THEN** the page shows a recoverable error and does not report the token as invalid solely because of that failure

#### Scenario: Activation completed but login did not
- **WHEN** the API explicitly reports committed activation without a session
- **THEN** the page offers `/login` with the established password and does not claim authentication or request another signup
