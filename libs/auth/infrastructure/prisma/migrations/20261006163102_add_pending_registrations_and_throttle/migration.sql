-- CreateTable
CREATE TABLE "auth_pending_registrations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token_hash" TEXT,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "auth_pending_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verification_resend_throttle" (
    "identifier" TEXT NOT NULL,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "auth_verification_resend_throttle_pkey" PRIMARY KEY ("identifier")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_pending_registrations_email_key" ON "auth_pending_registrations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_pending_registrations_token_hash_key" ON "auth_pending_registrations"("token_hash");

-- CreateIndex
CREATE INDEX "auth_pending_registrations_expires_at_idx" ON "auth_pending_registrations"("expires_at");

-- CreateIndex
CREATE INDEX "auth_verification_resend_throttle_window_started_at_idx" ON "auth_verification_resend_throttle"("window_started_at");
