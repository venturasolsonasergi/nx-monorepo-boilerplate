# Spec Delta: web/authentication

## ADDED Requirements

### Requirement: Offer social sign-in from login and signup
The `/login` and `/signup` routes SHALL render a "Continue with Google" action only when the public auth configuration's `allowedProviders` includes `google`, obtained from `GET /auth/public-config`. Activating the action SHALL call `POST /auth/oauth/google` with credentials included and SHALL send the browser to the returned `authorizationUrl` as a full-page navigation. While the start request is in flight the action SHALL be disabled. A failed start request SHALL show an inline recoverable message, SHALL NOT navigate the browser away, and SHALL leave the action usable again. The client SHALL treat a failed or missing public configuration as "no social options known" and SHALL still render the email flows.

#### Scenario: Google action offered when configured
- **WHEN** `/login` or `/signup` renders and public configuration reports `allowedProviders` including `google`
- **THEN** the page shows the "Continue with Google" action alongside the email form

#### Scenario: Google action hidden when not configured
- **WHEN** `/login` or `/signup` renders and public configuration reports `allowedProviders` without `google`, or the configuration request fails
- **THEN** the page shows no Google action and the email flows remain usable

#### Scenario: Starting the Google flow
- **WHEN** the user activates the "Continue with Google" action and `POST /auth/oauth/google` succeeds
- **THEN** the browser is sent to the returned authorization URL as a full-page navigation, carrying the state cookie set by that response

#### Scenario: Start request fails
- **WHEN** the user activates the action and the start request fails with a validation, rate-limit, or network error
- **THEN** the page shows an inline recoverable message, the browser stays on the page, and the action becomes usable again

## MODIFIED Requirements

### Requirement: Present the OAuth callback outcome
The `/auth/oauth/callback` route SHALL read the `error` query parameter. When it is present the route SHALL render a failure message that includes the error value and offer a link to `/login`. When it is absent the route SHALL resolve the browser session established by the callback's HTTP-only cookie, clear any previous caller's cached private data, and continue to `/settings` opened with the authorized return destination `/dashboard`; it SHALL NOT itself present sign-in or profile forms. If the session cannot be resolved after a callback without an error, the route SHALL show a recoverable message and offer a link to `/login` instead of continuing.

#### Scenario: OAuth login succeeded
- **WHEN** the browser opens `/auth/oauth/callback` without an `error` parameter
- **THEN** the session is resolved and the client continues to `/settings` opened with the authorized return destination `/dashboard`

#### Scenario: OAuth login succeeded for an identity with a profile
- **WHEN** the browser opens `/auth/oauth/callback` without an `error` parameter for an identity that already owns a profile
- **THEN** the session is resolved and the client continues to `/dashboard`

#### Scenario: OAuth login succeeded for an identity without a profile
- **WHEN** the browser opens `/auth/oauth/callback` without an `error` parameter for an identity that owns no profile
- **THEN** the client continues to `/settings` opened with return destination `/dashboard`, which presents the profile creation form

#### Scenario: OAuth login failed
- **WHEN** the browser opens `/auth/oauth/callback?error=<code>`
- **THEN** the page shows a failure message that includes the error value and offers a link to `/login`

#### Scenario: Callback without an error but without a resolvable session
- **WHEN** the browser opens `/auth/oauth/callback` without an `error` parameter and the session cannot be resolved
- **THEN** the page shows a recoverable message and offers a link to `/login`, and does not continue to `/settings`
