# auth SDD Evolution Log

## Spec Changes
- Created the `auth/identity-sessions` capability contract: signup pending verification, email verification, verified-only login, session validation/revocation, refresh, password reset, and OAuth.

## Domain Changes
- Initial auth domain scaffold (identity entity, value objects, domain service).

## Application Changes
- Initial auth application scaffold (use cases and repository/provider ports).

## Infrastructure Changes
- Added the auth service backed by self-hosted Better Auth 1.7.7 and an isolated Prisma persistence (auth_db).
