-- AlterTable: add pinned and pinnedAt columns to comments
ALTER TABLE "comments" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "comments" ADD COLUMN "pinnedAt" TIMESTAMP(3);
