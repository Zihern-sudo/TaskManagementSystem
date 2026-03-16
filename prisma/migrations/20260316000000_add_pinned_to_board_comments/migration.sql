-- AlterTable: add pinned and pinnedAt columns to board_comments
ALTER TABLE "board_comments" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "board_comments" ADD COLUMN "pinnedAt" TIMESTAMP(3);
