-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('BADMINTON', 'PICKLEBALL', 'TENNIS', 'TABLE_TENNIS', 'SQUASH', 'PADEL', 'OTHER');

-- AlterTable: existing tournaments were badminton, so the default preserves them.
ALTER TABLE "Tournament" ADD COLUMN "sport" "Sport" NOT NULL DEFAULT 'BADMINTON';
