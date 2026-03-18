-- Make password nullable to support Google SSO users who have no password
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
