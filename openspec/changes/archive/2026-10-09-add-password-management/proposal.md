# Proposal

## Why

The `/settings` page exposes only read-only profile data and the language preference. Users cannot see which email their session belongs to, cannot learn when their password was last changed, and cannot change their password; the only path to a new password is the recover-when-forgotten reset flow. Additionally, the current password policy (minimum 8 characters, enforced only at signup completion) is weak and inconsistently applied: the reset flow and the future password change have no shared validation, and the browser gives no feedback about password requirements.

## What Changes

- Add an **account security section** to the `/settings` page that shows the session email, when the password was last modified, and a change-password entry point. The section is hidden when the identity has no password credential.
- Add `GET /auth/account` returning the session identity's email, whether a password credential exists, and the password's last modification time.
- Add `POST /auth/password/change` requiring the current password; on success the password is updated and **every other session of the identity is revoked**, while the calling device keeps its session (rotated), so every other device must sign in again.
- Introduce a **stronger password policy** (minimum 12 characters, at least one lowercase, one uppercase, one digit, and one special character) enforced server-side at all three password entry points (`/auth/signup/complete`, `/auth/reset-password/confirm`, and the new `/auth/password/change`) and surfaced client-side with a per-rule checklist that marks which requirements are still unmet.
- Extend the `/complete-signup` and `/reset-password` forms to present the same rule checklist and to reject non-conforming passwords before submission.
- Add `PATCH /users/me` so an authenticated caller can update their profile's name, surname, address, and phone, with the same field validation as creation; the `/settings` profile section gains an edit control that swaps the read-only display for a pre-filled profile form and reflects the updated values after saving.
- Tightening the accepted password rules at `/auth/signup/complete` and `/auth/reset-password/confirm` is a **contract tightening**: clients submitting non-conforming passwords now receive `400` validation errors. Existing accounts and logins are unaffected; the policy applies only when a password is set or changed.
- Email change was considered and is an explicit **non-goal** for this change.

## Capabilities

### New Capabilities

- `auth/password-management`: the auth service's password credential lifecycle - the shared password policy across all password entry points, the authenticated password change with other-session revocation, and the account summary that discloses the session email and password metadata.
- `web/account-security`: the browser's account security section on `/settings` - displaying the session email and password last-modified time, the change-password dialog with the rule checklist and other-device revocation consent, and the stay-signed-in outcome.
- `users/profile-update`: the users service's profile update - updating the name, surname, address, and phone of the profile owned by the session identity, with creation-grade validation and identity isolation.

### Modified Capabilities

- `web/authentication`: the `/complete-signup` and `/reset-password` password fields now present the shared rule checklist, reject non-conforming passwords before submission, and surface per-rule validation feedback.
- `web/user-management`: the `/settings` profile section now offers an edit flow that submits `PATCH /users/me` and reflects the updated values.

## Impact

- **`libs/auth`** (auth microservice): new use cases and `AuthProvider` port methods for password change and account summary; controller endpoints with Zod validation; Better Auth adapter methods wrapping `/change-password` (revoking the other sessions and propagating the rotated replacement session cookie) and direct Prisma reads for the account summary; `libs/auth/specs/openapi.yaml` documents the two new endpoints.
- **`libs/users`** (users microservice): new update-profile use case and repository method; `PATCH /users/me` controller endpoint reusing the creation validation semantics; `libs/users/specs/openapi.yaml` documents the new endpoint.
- **`libs/shared/domain`**: new pure password-policy primitive (no NestJS, Prisma, or Zod imports) consumed by both services and the web client so the rules are never duplicated.
- **`apps/web`**: settings feature gains the account security section, the change-password dialog (a new Dialog UI primitive under `shared/ui`), and an inline profile edit flow reusing the existing profile form; auth feature's complete-signup and reset pages adopt the rule checklist; i18n resources (`es`/`en`/`ca`) gain the new copy; the account summary is refreshed and the caller stays signed in after a password change.
- **Tests**: auth and users use-case/contract specs, web component tests for the new section, dialog, and edit flow, and browser e2e for the change-password and profile-edit flows.
