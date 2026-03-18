-- Add dedicated password reset token fields to support the forgot-password flow
ALTER TABLE "users" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordResetExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_passwordResetToken_key" ON "users"("passwordResetToken");
