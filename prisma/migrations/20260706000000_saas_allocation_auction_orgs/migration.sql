-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AllocationMethod" AS ENUM ('SNAKE_DRAFT', 'RANDOM_ASSIGNMENT', 'LIVE_AUCTION');

-- CreateEnum
CREATE TYPE "AuctionLotStatus" AS ENUM ('OPEN', 'SOLD', 'UNSOLD', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DraftLogAction" ADD VALUE 'LOT_OPENED';
ALTER TYPE "DraftLogAction" ADD VALUE 'BID_PLACED';
ALTER TYPE "DraftLogAction" ADD VALUE 'LOT_SOLD';
ALTER TYPE "DraftLogAction" ADD VALUE 'LOT_UNSOLD';
ALTER TYPE "DraftLogAction" ADD VALUE 'LOT_CANCELLED';
ALTER TYPE "DraftLogAction" ADD VALUE 'RANDOM_ASSIGNMENT_RUN';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "allocationMethod" "AllocationMethod" NOT NULL DEFAULT 'SNAKE_DRAFT',
ADD COLUMN     "auctionDefaultBasePrice" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "auctionMinIncrement" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "auctionPurse" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "purseOverride" INTEGER;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "basePrice" INTEGER;

-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "price" INTEGER;

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionLot" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "status" "AuctionLotStatus" NOT NULL DEFAULT 'OPEN',
    "basePrice" INTEGER NOT NULL,
    "currentBid" INTEGER,
    "currentBidTeamId" UUID,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "finalPrice" INTEGER,
    "winningTeamId" UUID,
    "openedByUserId" UUID,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "bidderUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AuctionLot_tournamentId_status_idx" ON "AuctionLot"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "AuctionLot_tournamentId_createdAt_idx" ON "AuctionLot"("tournamentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuctionLot_playerId_idx" ON "AuctionLot"("playerId");

-- CreateIndex
CREATE INDEX "AuctionBid_lotId_createdAt_idx" ON "AuctionBid"("lotId", "createdAt");

-- CreateIndex
CREATE INDEX "AuctionBid_teamId_idx" ON "AuctionBid"("teamId");

-- CreateIndex
CREATE INDEX "Tournament_organizationId_idx" ON "Tournament"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_currentBidTeamId_fkey" FOREIGN KEY ("currentBidTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "AuctionLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_bidderUserId_fkey" FOREIGN KEY ("bidderUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guarantee at most one OPEN lot per tournament (partial unique index; not expressible in Prisma schema)
CREATE UNIQUE INDEX "AuctionLot_one_open_per_tournament" ON "AuctionLot"("tournamentId") WHERE "status" = 'OPEN';
