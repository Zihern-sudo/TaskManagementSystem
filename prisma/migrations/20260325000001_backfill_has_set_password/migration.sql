-- Back-fill hasSetPassword for users who already have a password in the DB.
-- This covers accounts created before the hasSetPassword column was introduced
-- (e.g. seeded admin/member accounts, users who accepted invites, or users who
-- reset their password) whose row received DEFAULT false from the prior migration.
UPDATE "users"
SET "hasSetPassword" = true
WHERE "password" IS NOT NULL;
