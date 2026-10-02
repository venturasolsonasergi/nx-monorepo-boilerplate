# Tasks

## 1. Contracts and compatibility

- [x] 1.1 [auth] Pin a Better Auth version and demonstrate, with a focused integration spike, that the Prisma adapter and REST wrappers can support verified-email signup, session renewal/revocation, OAuth callback, password reset, and the requested auth table mapping; record test output and stop to revise the change for approval if a dedicated `auth_password_reset_tokens` table cannot be supported without duplicate token authority. Result: pinned `better-auth@1.7.7`; `getAuthTables` resolves user/session/account/verification to `auth_users`/`auth_sessions`/`auth_accounts`/`auth_verification_tokens` and reports no dedicated reset table. Approved revision: reset tokens live in `auth_verification_tokens` (`reset-password:<token>` identifier), so no `auth_password_reset_tokens` table is created.
- [x] 1.2 [auth] Write `libs/auth/specs/openapi.yaml` for signup, login, logout, refresh, email verification, reset request/confirm, OAuth start/callback, cookie security, success/error responses, and documented flows; verify with `pnpm run validate:openapi -- --service auth` after service discovery metadata is in place.
- [x] 1.3 [users] Replace only the profile-creation request/response and errors in `libs/users/specs/openapi.yaml`, retaining `/users/health`; verify with `pnpm run validate:openapi -- --service users`.

## 2. Auth persistence

- [x] 2.1 [auth] Add `libs/auth/microservice.json`, service configuration and the pinned Better Auth dependency; verify the metadata is present and the lockfile resolves the pinned dependency.
- [x] 2.2 [auth] Add the isolated Prisma schema/config, generated-client setup, and independent migrations for identity/account/session/verification (reset tokens share `auth_verification_tokens`); verify `pnpm prisma:generate -- --service auth` and `pnpm prisma:migrate -- --service auth -- --name init_auth` against an isolated auth database.
- [x] 2.3 [auth/deployment] Provision `auth_db`, `AUTH_DATABASE_URL`, session secret, mail transport and OAuth credentials in deployment configuration without overwriting existing user configuration; verify a fresh database boot and an already-initialized volume setup reach `auth_db` successfully.

## 3. Auth endpoints and session security

- [x] 3.1 [auth] Implement the Better Auth adapter, thin controller and application-facing operations for signup, verification, verified-only login, logout and cookie renewal; verify contract tests via `pnpm run test:contract -- --service auth`, including no session before verification, expiry and revocation.
- [x] 3.2 [auth] Implement reset request/confirmation, single-use token handling and all-session revocation through Better Auth; verify non-enumeration, expiry, reuse and old-cookie rejection with `pnpm run test:contract -- --service auth`.
- [x] 3.3 [auth] Implement provider allowlist and OAuth start/callback handling, checked redirects and verified-email linking policy; verify success, unverified-email and failure callbacks with `pnpm run test:contract -- --service auth`.
- [x] 3.4 [auth/API host] Mount AuthModule and the session-validation middleware on protected routes, injecting authUserId/verification context and preserving public health paths; verify authenticated, invalid-cookie, cross-origin and CSRF cases with `pnpm run test:contract -- --service auth` and an API-host integration test.

## 4. Users profile cutover

- [x] 4.1 [users] Before replacing the schema, confirm a backfill mapping for any existing rows or verify an empty database; migrate to a unique string authUserId and remove email identity ownership only when data is safe; verify `pnpm prisma:generate -- --service users` and `pnpm prisma:migrate -- --service users -- --name profile_auth_user_id`, plus a uniqueness/backfill check. Result: `users_db` verified empty (0 rows) before the drop; migration adds `authUserId TEXT NOT NULL` with a unique index and drops `email`.
- [x] 4.2 [users] Replace the registration use case, repository, domain entity and `POST /users` handler with verified-session profile creation using server-derived authUserId; update the existing users contract tests for 201/400/401/403/409, retained health and absence of identity fields; verify `pnpm run test:contract -- --service users` and `pnpm run validate:openapi -- --service users`.

## 5. Cross-service integration gates

- [x] 5.1 [auth/users/API host] Exercise signup -> verify -> login -> authenticated profile creation plus logout/revocation and a configured OAuth flow through the host, while leaving orders untouched; verify the API-host e2e tests and `pnpm run test:contract -- --service auth` and `pnpm run test:contract -- --service users`.
- [x] 5.2 [auth/users] Validate the completed change with `openspec validate auth-identity --strict`, `pnpm run validate:openapi -- --service auth`, `pnpm run validate:openapi -- --service users`, `pnpm run check:dependencies`, `pnpm run validate:domain`, and `pnpm run validate:architecture`; record any legacy-data or client cutover prerequisite before release. Result: all checks pass. Release prerequisites: (1) for any environment with existing users rows, backfill `authUserId` from verified identities before applying the destructive users migration; `users_db` was empty in this environment. (2) Coordinate the web client cutover to signup -> verify -> login -> authenticated `POST /users`. (3) Supply real `AUTH_SECRET`, SMTP and OAuth credentials in deployment; the mail adapter is SMTP-configured and fails closed when unset.

## 6. Browser-flow review follow-ups

- [x] 6.1 [auth] Align the OAuth callback with Better Auth: set `basePath` to `/auth`, expose `GET /auth/callback/{provider}` (matching the generated redirect URI), and send the post-callback destination to the web origin (`AUTH_WEB_URL`) instead of the API origin. Verified the authorization URL `redirect_uri` equals the exposed route.
- [x] 6.2 [auth] Make emailed links usable: send service-hosted verification/reset links, expose `GET /auth/verify-email` and `GET /auth/reset-password/confirm`, redirect only to trusted web origins, and update the e2e to follow the real link instead of extracting the token.
- [x] 6.3 [auth] Reject OAuth sessions when the provider email is not verified; redirect to the web app with an error and never set the session cookie.
- [x] 6.4 [auth/API host] Add `OriginValidationMiddleware` to auth and users state-changing routes (including logout and refresh) and cover cross-origin/CSRF rejection in e2e; keep session validation separate.
- [x] 6.5 [API host/web] Enable credentialed CORS from trusted origins in `configureApp` and add a Vite dev proxy for `/auth`, `/users`, and `/orders`; verify credentialed CORS at the HTTP layer.
- [x] 6.6 [tooling] Make the official `pnpm run test:contract` runner use `node --experimental-vm-modules` with the Jest binary so ESM suites run without manual environment overrides.
- [x] 6.7 [auth] Propagate the OAuth state cookie end to end: return its `Set-Cookie` from `startOAuth`, forward the browser cookie on the internal callback, and cover a full callback against a simulated provider (session created, unverified email rejected) instead of only checking the redirect URI.
- [x] 6.8 [web] Register the browser journeys the API redirects to: `/verified`, `/reset-password`, and `/auth/oauth/callback`, and default the web API client to same-origin requests (Vite proxy) with credentials.
- [x] 6.9 [architecture] Cover every discovered service (including auth) in the architecture gates by discovering services in `check-domain-invariants`, `validate-domain-purity`, and `check-dependencies` instead of hardcoding users and orders.

## 7. Follow-up coverage and web alignment

- [x] 7.1 [auth] Add API-host e2e coverage for token and session expiry: an expired verification token is rejected (`error=INVALID_TOKEN`), an expired reset token is rejected with `400`, and an expired session is rejected with `401` on protected routes and `POST /auth/refresh` without renewal. Expiry is induced only at the test boundary; no runtime behavior changes.
- [x] 7.2 [web] Align the users feature with the new profile contract: expect integer `id` and string `authUserId` with `name`/`surname`/`address`/`phone` and no `email`; submit profile fields only; remove the stale email-based list path; and gate `POST /users` behind an active verified session checked via `POST /auth/refresh`.
- [x] 7.3 [docs] Record the follow-up coverage in design.md, including verification/reset-token and session expiry, idempotent verification-token reuse, and alignment of the web client with the profile contract.
- [x] 7.4 [auth] Cover reuse of a valid email-verification token in the API-host e2e suite: repeated verification succeeds idempotently, leaves the identity verified, and never creates a session. Verify both the POST API and emailed GET link behavior.
