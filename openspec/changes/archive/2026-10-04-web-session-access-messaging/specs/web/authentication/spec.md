# Spec Delta

## MODIFIED Requirements

### Requirement: Present the email verification outcome
The `/verified` route SHALL read the `verified` and `error` query parameters and SHALL render the matching outcome message, plus a link back to `/users`. When verification succeeds, the message SHALL confirm the email was verified without implying that the browser client provides a sign-in flow.

#### Scenario: Verification succeeded
- **WHEN** the browser opens `/verified?verified=true`
- **THEN** the page confirms that the email was verified, does not claim that the user can sign in through the client, and offers a link to `/users`

#### Scenario: Verification failed
- **WHEN** the browser opens `/verified?error=<code>`
- **THEN** the page shows a failure message that includes the error value and offers a link to `/users`