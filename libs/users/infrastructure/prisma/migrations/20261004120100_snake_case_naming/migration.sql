-- Rename users physical identifiers to lowercase snake_case.
-- This migration only renames the existing table, column, sequence, index, and
-- constraint so that all existing profile rows and identifiers are preserved. It
-- does not drop or add any column or change any data type.

ALTER TABLE "UserRecord" RENAME TO "user_profiles";
ALTER TABLE "user_profiles" RENAME COLUMN "authUserId" TO "auth_user_id";

-- The SERIAL sequence keeps its old name after a table rename; align it so the
-- schema matches the standardized `<table>_<column>_seq` convention.
ALTER SEQUENCE "UserRecord_id_seq" RENAME TO "user_profiles_id_seq";

ALTER INDEX "UserRecord_pkey" RENAME TO "user_profiles_pkey";
ALTER INDEX "UserRecord_authUserId_key" RENAME TO "user_profiles_auth_user_id_key";
