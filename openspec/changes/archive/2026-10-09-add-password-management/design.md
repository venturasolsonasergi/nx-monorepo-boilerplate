# Design

## Context

The auth microservice (`libs/auth`) fully encapsulates Better Auth 1.7.7 behind the `AuthProvider` port: the Better Auth handler is never mounted as middleware, so every capability is an adapter method, an application use case, a thin controller endpoint, and an entry in `libs/auth/specs/openapi.yaml`. The session check (`POST /auth/refresh`) returns `{ userId, status }`; the internal `AuthenticatedSession` already carries `email`, which the controller currently discards. Passwords live in the `Account` row (credential provider) whose `updatedAt` changes exactly when the credential is established or replaced (activation, reset, change); there is no dedicated `password_changed_at` column.

Verified against the installed better-auth 1.7.7: the core `/change-password` endpoint takes `{ currentPassword, newPassword, revokeOtherSessions }`, fails with `INVALID_PASSWORD` or `CREDENTIAL_ACCOUNT_NOT_FOUND` (400), and with `revokeOtherSessions: true` deletes all of the user's sessions and then issues a fresh session for the caller, returning a replacement cookie. Core `/change-email` exists but is disabled by default and its confirmation path is the very `POST /verify-email` this repo deliberately retired (410) - see the proposal's non-goal.

On the web, password fields are inconsistent: `complete-signup-page.tsx` hardcodes a local `MIN_PASSWORD_LENGTH = 8`, the reset page checks nothing client-side, and there is no Dialog primitive under `shared/ui`.

## Goals / Non-Goals

**Goals:**

- One password policy, defined once, enforced at the server edge and rendered client-side as a checklist.
- Password change that provably ends every other session of the identity while keeping the calling device signed in.
- Account summary endpoint that exposes only what the settings section needs (email, `hasPassword`, `passwordUpdatedAt`).
- Profile editing on the settings page backed by a new `PATCH /users/me` in the users service.
- No database migration.

**Non-Goals:**

- Email change (deferred; would conflict with the retired verification endpoint until redesigned).
- Setting a password for OAuth-only identities (the section hides instead).
- A strength meter bar (the checklist already communicates what is missing).
- Forced rotation or retroactive re-validation of existing credentials.

## Decisions

- **Policy lives in `libs/shared/domain` as a pure function.** `validatePassword(password): PasswordPolicyViolation[]` plus the exported rule list (min 12, max 128, lower/upper/digit/special classes), with no NestJS, Prisma, or Zod imports - exactly the constraint `libs/shared/domain/README.md` states. The auth controller builds a Zod refinement over it; the web imports the same module for the checklist and pre-submit gating. *Alternatives:* duplicating the rules per edge (rejected: drift between server and client); hosting it in `libs/auth` only (rejected: the web cannot depend on a microservice lib without coupling it to server internals).

- **Password change revokes the other sessions and rotates the caller's.** The adapter calls `/change-password` with `revokeOtherSessions: true`, which deletes every session of the identity and issues a fresh one for the caller, and propagates the replacement session cookie to the browser. Net effect: every other device is signed out and the caller stays authenticated on a rotated session. Error mapping: `INVALID_PASSWORD` -> the existing `InvalidPasswordError` (400, current-password field), `CREDENTIAL_ACCOUNT_NOT_FOUND` -> a new `NoPasswordCredentialError` (400), 429/5xx map through the existing `RateLimitedError`/`AuthProviderError` handling. *Alternatives:* chaining a sign-out that also ends the caller's session (rejected: forces the operator to re-authenticate unnecessarily); calling `change-password` without revocation (rejected: leaves other devices signed in); a dedicated `password_changed_at` column maintained via hooks on every password-write path including Better Auth's internal reset (rejected: cross-cutting bookkeeping for no observable gain).

- **Account summary reads Prisma directly behind an application port.** A new `AccountSummaryReader` port in `libs/auth/application`, implemented in infrastructure with the existing `AuthPrismaService`: one query for the identity row (`email`) and one for the credential account row (`password` presence -> `hasPassword`, `updatedAt` -> `passwordUpdatedAt`, null when absent). This follows the established pending-registration adapter pattern and avoids scraping Better Auth's `/get-session`, which does not expose credential metadata. *Alternative:* extending `POST /auth/refresh` with these fields (rejected: the refresh runs on every app load and the settings page is the only consumer; keeping the session contract unchanged avoids re-opening the session spec).

- **Both new endpoints belong to the auth controller** (`GET /auth/account`, `POST /auth/password/change`): the auth service owns identity, credentials, and sessions. OpenAPI entries are added to `libs/auth/specs/openapi.yaml` with error shapes aligned to the delta spec (400 with field-identifying `details`, 401, 429 with `retryAfterSeconds`, 503).

- **The web gets one Dialog primitive and one checklist component.** A shadcn-style Dialog under `apps/web/src/shared/ui` (none exists today) hosts the change-password form; a presentational rule-checklist component fed by the shared policy function is reused by the complete-signup page, the reset page, and the dialog. All new copy is added as `es`/`en`/`ca` resources (the user-supplied Spanish consent sentence is the `es` resource; `en` and `ca` translations ship with it). The change-password API call and its hook live in the auth feature (it is an auth contract) and are consumed by the settings feature.

- **`PATCH /users/me` mirrors creation semantics instead of inventing new ones.** The users service gains an `UpdateProfileUseCase` and a repository update method keyed by the session-derived `authUserId`; the controller reuses the creation schema's semantics (trim, non-empty for the four fields, strict body), maps the existing `ProfileNotFoundError` to `404`, and authorizes by session only - sessions already belong to verified identities under the auth contract, and the read path (`GET /users/me`) already dropped the extra verification check, so a verification gate here would be dead code. The endpoint is documented in `libs/users/specs/openapi.yaml`. *Alternatives:* a partial-update schema (rejected: the settings form always submits all four fields, and full replacement keeps one validation path); requiring email verification like creation (rejected: unreachable for session callers).

- **The web edits the profile inline, not in a dialog.** Activating the edit control swaps the read-only profile view for the existing profile form component, pre-filled with the stored values; saving submits `PATCH /users/me`, success returns to the display showing updated values, and cancel returns without any request. The form component stays presentational (initial values and submit handler injected) so creation and update reuse it without coupling their targets. *Alternative:* reusing the new Dialog primitive (rejected: the dialog earns its place on the password's security framing; plain text fields read better in place).

- **Post-change web state keeps the caller signed in.** On success: leave the session and private caches in place, invalidate the account summary so the password's last-modified time is current, and close the dialog with a confirmation. No navigation to `/login` and no logout idiom.

## Risks / Trade-offs

- [`updatedAt` proxy skews if future code mutates the credential row without touching the password] -> Today activation, reset, and change are the only writers; if another writer appears, revisit the dedicated column. The observable requirement is "when the current password was established or last changed", which the proxy satisfies today.
- [The rotated replacement session cookie is lost before the browser stores it] -> The caller would lose this device's session while every other session is already revoked; signing in again with the new password restores access, and no other device keeps access. Logged as an operational incident.
- [Existing web tests use non-conforming passwords such as `password123`] -> Update fixtures to policy-conforming passwords; the shared policy module makes the requirement explicit in tests.
- [Tightened server policy 400s previously-accepted weak passwords at signup/reset] -> Documented in the proposal as a contract tightening; the browser always validates before submitting, so only non-browser clients observe the change.
- [Creation and update share one profile form component with different submit targets] -> Keep the component presentational (initial values plus submit handler injected) so neither flow can silently submit to the wrong endpoint.
- [Revoking other sessions and rotating the caller happen in one Better Auth call] -> Atomic within the provider; a failure maps to a recoverable 503 and leaves the credential unchanged, so no session is revoked solely because of that failure.

## Migration Plan

No database migration and no backfill: the policy applies only to new submissions, and the timestamp reuses the existing `updatedAt`. Deployment order does not matter; rollback is a plain revert of the two endpoints, the shared policy adoption, and the web sections. Existing sessions and credentials remain valid throughout.
