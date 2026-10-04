# Proposal

## Why

The browser currently implies that users can sign in from the email-verification result or recover a session from `/users`, but the client has no login or verification-request screen. Correcting these messages avoids promising a flow the app cannot complete while keeping the missing journey explicit as a release dependency.

## What Changes

- Update the successful email-verification message so it confirms verification without claiming that sign-in is available in the client.
- Update the unauthenticated `/users` message and remove the `/verified` link presented as a way to log in.
- Keep the absent login/verification-request screen documented as a release dependency; do not implement it in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web/authentication`: Limit the verification-success message to confirming the email-verification outcome.
- `web/user-management`: Make the unauthenticated state accurately describe the missing in-client sign-in flow.
- `web/navigation`: Remove the unauthenticated `/users` link that is presented as a recovery path despite not establishing a session.

## Impact

- Update the verification and profile-page copy, the browser smoke assertions, and the corresponding persistent web requirements.
- No backend contract, API behavior, or authentication capability is added; login and verification-request UI remain a release dependency.