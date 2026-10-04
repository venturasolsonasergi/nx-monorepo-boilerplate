-- Rename auth physical identifiers to lowercase snake_case.
-- This migration only renames existing columns, indexes, and constraints so that
-- all existing rows and issued identifiers are preserved. It does not drop or add
-- any column or change any data type.

-- auth_users
ALTER TABLE "auth_users" RENAME COLUMN "emailVerified" TO "email_verified";
ALTER TABLE "auth_users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "auth_users" RENAME COLUMN "updatedAt" TO "updated_at";

-- auth_sessions
ALTER TABLE "auth_sessions" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "auth_sessions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "auth_sessions" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "auth_sessions" RENAME COLUMN "ipAddress" TO "ip_address";
ALTER TABLE "auth_sessions" RENAME COLUMN "userAgent" TO "user_agent";
ALTER TABLE "auth_sessions" RENAME COLUMN "userId" TO "user_id";

-- auth_accounts
ALTER TABLE "auth_accounts" RENAME COLUMN "accountId" TO "account_id";
ALTER TABLE "auth_accounts" RENAME COLUMN "providerId" TO "provider_id";
ALTER TABLE "auth_accounts" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "auth_accounts" RENAME COLUMN "accessToken" TO "access_token";
ALTER TABLE "auth_accounts" RENAME COLUMN "refreshToken" TO "refresh_token";
ALTER TABLE "auth_accounts" RENAME COLUMN "idToken" TO "id_token";
ALTER TABLE "auth_accounts" RENAME COLUMN "accessTokenExpiresAt" TO "access_token_expires_at";
ALTER TABLE "auth_accounts" RENAME COLUMN "refreshTokenExpiresAt" TO "refresh_token_expires_at";
ALTER TABLE "auth_accounts" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "auth_accounts" RENAME COLUMN "updatedAt" TO "updated_at";

-- auth_verification_tokens
ALTER TABLE "auth_verification_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "auth_verification_tokens" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "auth_verification_tokens" RENAME COLUMN "updatedAt" TO "updated_at";

-- Indexes and foreign key constraints
ALTER INDEX "auth_sessions_userId_idx" RENAME TO "auth_sessions_user_id_idx";
ALTER INDEX "auth_accounts_userId_idx" RENAME TO "auth_accounts_user_id_idx";
ALTER TABLE "auth_sessions" RENAME CONSTRAINT "auth_sessions_userId_fkey" TO "auth_sessions_user_id_fkey";
ALTER TABLE "auth_accounts" RENAME CONSTRAINT "auth_accounts_userId_fkey" TO "auth_accounts_user_id_fkey";
