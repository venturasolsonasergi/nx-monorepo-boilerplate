# Proposal

## Why

Signup can claim an email was sent when SMTP failed, leaving a pending identity with no
recovery path. Move to a bounded email-first registration that establishes credentials
only after proof of email control, honestly reports mail outcomes, and completes with an
authenticated browser session.

## What Changes

- **BREAKING**: `POST /auth/signup` accepts only an email and creates a pending
  registration, not an `auth_user`, credential, session, or business profile. Its `201`
  response has no `userId` and reports `emailStatus: accepted | failed | throttled`.
- A registration expires exactly 48 hours after initiation. Repeat signup and resend
  reuse an unexpired registration without extending its deadline. An expired registration
  requires a new signup; old links cannot activate the replacement registration.
- Add `POST /auth/verification/resend` with a uniform request-acceptance response, a
  source-first atomic rate limit shared with initial signup, and bounded storage. The web
  offers resend, waiting and failure states, and a support contact configured through
  `AUTH_SUPPORT_EMAIL` without revealing whether a pending registration already exists.
- **BREAKING**: opening `GET /auth/verify-email` only leads to the password-entry page;
  it neither consumes the token nor activates a session. New `POST /auth/signup/complete`
  establishes the password and verified identity with a valid, single-use registration
  token, issues the session cookie, and the browser continues to `/users` to
  complete the profile authenticated. The previous password-free `POST /auth/verify-email` activation is retired.
- Clean up expired pending registrations in the backend; enforce expiry on requests even
  before cleanup. Handle legacy unverified identities conservatively without deleting
  verified, OAuth-linked, or externally referenced accounts.
- Correct client-IP handling for authentication rate limits, preserve `429` and service
  failures instead of converting them to `401`, and reject unverified email/password
  sign-in before session creation. Session validation also rejects unverified identities.
- Production requires valid SMTP configuration, not live SMTP reachability at startup.
  Development uses Mailpit, with no silent logging fallback.
- Cover the real email link, password activation, authenticated return, expiry, replay,
  concurrency, SMTP failure/recovery, IP isolation, and session-error handling in tests.

Non-goals: a durable mail queue or retry worker; redesigning password-reset delivery or
OAuth; creating business profiles during registration; changing the existing password
reset or logout policy. The earlier revoke-password-then-reset recovery design is
superseded, not implemented alongside this flow.

## Capabilities

### New Capabilities
None; reuse the existing auth and web authentication capabilities.

### Modified Capabilities
- `auth/identity-sessions`: email-only pending registration with a fixed 48-hour lifetime,
  password-setting activation and session issuance, single-use links, resend and cleanup,
  public support configuration, and correct login/session/rate-limit failure behavior.
- `web/authentication`: email-only signup, pending/resend/support states, password-entry
  activation, expired-link restart, authenticated verification outcome, and distinct
  unauthenticated, rate-limited, and unknown session states.

## Impact

- `libs/auth`: OpenAPI contract, registration and activation use cases and ports, Better
  Auth integration, SMTP and public config, pending-registration and throttle persistence,
  migrations, session validation, and service tests.
- `apps/web`: authentication client, signup and completion routes, verified page, support
  link, rate-limit/error messaging, session/private-cache handling, and browser tests.
- `apps/api-e2e`: real SMTP return-path and activation/session/security coverage.
- Development and deployment: Mailpit in `docker-compose.yml`, `.env.example`, developer
  documentation, registration/throttle cleanup, and a reviewed legacy-account transition.
- Only `auth/identity-sessions` and `web/authentication` delta specs are modified. Host
  wiring remains in support of the auth contract, not a new platform capability.
