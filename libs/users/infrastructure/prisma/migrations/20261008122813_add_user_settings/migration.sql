-- CreateTable
CREATE TABLE "user_settings" (
    "id" SERIAL NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_auth_user_id_key" ON "user_settings"("auth_user_id");
