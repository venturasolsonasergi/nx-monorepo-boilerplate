-- DropIndex
DROP INDEX "UserRecord_email_key";

-- AlterTable
ALTER TABLE "UserRecord" DROP COLUMN "email",
ADD COLUMN     "authUserId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserRecord_authUserId_key" ON "UserRecord"("authUserId");
