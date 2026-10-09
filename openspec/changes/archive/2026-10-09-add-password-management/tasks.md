# Tasks

## 1. Shared password policy (`libs/shared/domain`)

- [x] 1.1 Add the pure password-policy module to `libs/shared/domain` (rule constants: min 12, max 128, lowercase, uppercase, digit, special; `validatePassword` returning the unmet-rule list) with no NestJS, Prisma, or Zod imports, and unit tests covering each rule and conforming passwords. Verify: `pnpm api:test` runs the new unit tests green and `pnpm validate:domain` passes.
- [x] 1.2 Verify the shared-boundary wiring is legal. Verify: `pnpm validate:architecture` and `pnpm check:dependencies` pass.

## 2. Auth backend: account summary (`libs/auth`)

- [x] 2.1 Add the `AccountSummaryReader` port in `libs/auth/application` and the Prisma implementation in `libs/auth/infrastructure` reading the identity email and the credential account (`hasPassword`, `passwordUpdatedAt`, null when absent), plus unit tests with an in-memory fake. Verify: `pnpm api:test` green.
- [x] 2.2 Add the `GET /auth/account` use case and controller endpoint (session-gated, 401 without a valid verified session, 200 with `email`/`hasPassword`/`passwordUpdatedAt`), and document it in `libs/auth/specs/openapi.yaml`. Verify: `pnpm api:test` green and `pnpm validate:openapi` passes.
- [x] 2.3 Extend the auth contract tests for the account summary (authenticated summary, no-credential identity, unauthenticated 401, no storage-name leakage). Verify: `pnpm test:contract` green.

## 3. Auth backend: password change (`libs/auth`)

- [x] 3.1 Add `NoPasswordCredentialError` to `libs/auth/application/auth.errors.ts` and the `AuthProvider` port method wrapping Better Auth `/change-password` (`revokeOtherSessions: true`) and returning the rotated replacement session cookie, mapping `INVALID_PASSWORD` and `CREDENTIAL_ACCOUNT_NOT_FOUND` per design, with adapter unit tests. Verify: `pnpm api:test` green.
- [x] 3.2 Add the `POST /auth/password/change` use case and controller endpoint (Zod body with the shared policy, 400 field-identifying errors, 401, 429 with retry interval, 503) that sets the rotated session cookie on success, and document it in `libs/auth/specs/openapi.yaml`. Verify: `pnpm api:test` green and `pnpm validate:openapi` passes.
- [x] 3.3 Add a host-level contract test that logs in, changes the password with the session cookie, and proves the return path: every other session is revoked, the response sets a rotated replacement session cookie that still authorizes a protected call, and re-login requires the new password. Verify: `pnpm test:contract` green.

## 4. Auth backend: policy at existing entry points (`libs/auth`)

- [x] 4.1 Apply the shared policy to the `signup/complete` and `reset-password/confirm` Zod schemas (replacing `MIN_PASSWORD_LENGTH`-only checks) so rejections identify the password field and unmet rules, and update the use-case tests for the new 400 details. Verify: `pnpm api:test` green.
- [x] 4.2 Update auth contract-test fixtures to policy-conforming passwords and add rejection cases for weak passwords at both entry points. Verify: `pnpm test:contract` green and `pnpm validate:openapi` passes.

## 5. Users backend: profile update (`libs/users`)

- [x] 5.1 Add the `UpdateProfileUseCase` in `libs/users/application` and the repository update method keyed by the session-derived `authUserId` (reusing `ProfileNotFoundError` for the missing-profile case), with unit tests using an in-memory repository covering the happy path, no-profile 404, and no-modification-on-validation-failure. Verify: `pnpm api:test` green.
- [x] 5.2 Add the `PATCH /users/me` controller endpoint reusing the creation schema semantics (trim, non-empty four fields, strict body) with 401/404/400 mappings, and document it in `libs/users/specs/openapi.yaml`. Verify: `pnpm api:test` green and `pnpm validate:openapi` passes.
- [x] 5.3 Add users contract tests for the update flow: update persists and is visible on `GET /users/me`, 404 without a profile, 400 for empty and unrecognized fields, caller-supplied identifiers ignored, unauthenticated 401, and no storage-name leakage. Verify: `pnpm test:contract` green.

## 6. Web: checklist and policy adoption (`apps/web`)

- [x] 6.1 Add the rule-checklist component (fed by the shared policy module, met/unmet marking per rule, accessible labels) and unit tests. Verify: `pnpm web:test` green.
- [x] 6.2 Adopt the checklist in `/complete-signup` and `/reset-password`, replacing the hardcoded minimum with policy gating before submission, and update their tests (including policy-conforming fixtures replacing `password123`). Verify: `pnpm web:test` green.

## 7. Web: account security section and change-password dialog (`apps/web`)

- [x] 7.1 Add the auth-feature API entry and hook for `GET /auth/account` and `POST /auth/password/change` (Zod response schemas, account-summary refresh on success with no logout) with unit tests. Verify: `pnpm web:test` green.
- [x] 7.2 Add a Dialog primitive under `apps/web/src/shared/ui` (shadcn-style, focus trap, Escape/overlay close) and render-noop tests. Verify: `pnpm web:test` green.
- [x] 7.3 Build the change-password dialog (two labeled fields with show/hide, checklist, other-device revocation consent gating submission, inline 400/429/network handling per spec, success stays signed in and closes with a confirmation) with component tests covering gated submit, wrong-current-password inline error, and recoverable failures. Verify: `pnpm web:test` green.
- [x] 7.4 Add the account security section to `/settings` (email, last-modified date, change control, hidden entry point when `hasPassword: false`, loading/401/recoverable states) with component tests, and add all new copy as `es`/`en`/`ca` resources. Verify: `pnpm web:test` and `pnpm web:build` green.

## 8. Web: profile editing (`apps/web`)

- [x] 8.1 Add the users-feature API entry and hook for `PATCH /users/me` (Zod request/response schemas, profile cache update on success) with unit tests. Verify: `pnpm web:test` green.
- [x] 8.2 Add the edit control to the settings profile section: swap the read-only view for the pre-filled profile form on edit, submit to `PATCH /users/me` on save, cancel discards without a request, success shows the updated values, inline field errors on 400, recoverable message on other failures; add the new copy as `es`/`en`/`ca` resources. Verify: `pnpm web:test` green and `pnpm web:build` passes.

## 9. Web end-to-end (`apps/web-e2e`)

- [x] 9.1 Add a browser e2e for the change-password flow: settings -> dialog -> consent -> submit -> stays authenticated on `/settings` with the refreshed account summary, with the API mocked at the contract level and no database, email, or live API dependency. Verify: `pnpm web:e2e` green.
- [x] 9.2 Add browser e2e coverage for the checklist on `/complete-signup` and `/reset-password` (unmet rules block submission, met rules enable it). Verify: `pnpm web:e2e` green.
- [x] 9.3 Add a browser e2e for profile editing: settings -> edit -> save shows the updated values, and cancel keeps the stored values without a request, with the API mocked at the contract level. Verify: `pnpm web:e2e` green.

## 10. Repo-wide integration checks

- [x] 10.1 Run the full repo verification for the affected boundaries. Verify: `pnpm verify`, `pnpm lint`, and `openspec validate add-password-management` all pass.
