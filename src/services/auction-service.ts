import {
  AllocationMethod,
  AuctionLotStatus,
  DraftLogAction,
  DraftPhase,
  PickStatus,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { validateBidAmount } from "@/lib/draft/auction-bidding";
import { prisma } from "@/lib/prisma";
import { DraftServiceError } from "@/services/draft-service";

/**
 * IPL-style live auction engine. One lot (player under the hammer) is OPEN at
 * a time per tournament — enforced by a partial unique index plus checks here.
 * Bids use optimistic concurrency: a bid names the lot's bidCount it saw and
 * only lands if the lot is unchanged, so two phones tapping simultaneously can
 * never both win the same increment.
 */

export interface TeamPurseState {
  teamId: string;
  purse: number;
  spent: number;
  remaining: number;
}

function assertLiveAuctionTournament(tournament: {
  allocationMethod: (typeof AllocationMethod)[keyof typeof AllocationMethod];
  draftPhase: (typeof DraftPhase)[keyof typeof DraftPhase];
}) {
  if (tournament.allocationMethod !== AllocationMethod.LIVE_AUCTION) {
    throw new DraftServiceError("This tournament is not running a live auction.");
  }
  if (tournament.draftPhase !== DraftPhase.LIVE) {
    throw new DraftServiceError("The auction is not live.");
  }
}

async function computeTeamSpentTx(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  teamId: string,
): Promise<number> {
  const result = await tx.pick.aggregate({
    where: {
      tournamentId,
      teamId,
      status: PickStatus.CONFIRMED,
      price: { not: null },
    },
    _sum: { price: true },
  });
  return result._sum.price ?? 0;
}

async function countTeamCategoryOccupancyTx(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  teamId: string,
  rosterCategoryId: string,
): Promise<number> {
  const [pickCount, team] = await Promise.all([
    tx.pick.count({
      where: {
        tournamentId,
        teamId,
        status: PickStatus.CONFIRMED,
        player: { rosterCategoryId },
      },
    }),
    tx.team.findFirst({
      where: { id: teamId, tournamentId, deletedAt: null },
      select: { ownerUserId: true },
    }),
  ]);
  if (!team) throw new DraftServiceError("Team not found.");
  let stubCount = 0;
  if (team.ownerUserId) {
    stubCount = await tx.player.count({
      where: {
        tournamentId,
        deletedAt: null,
        rosterCategoryId,
        linkedOwnerUserId: team.ownerUserId,
      },
    });
  }
  return pickCount + stubCount;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
  );
}

export async function openAuctionLot(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findFirst({
        where: { slug: params.tournamentSlug, deletedAt: null },
      });
      if (!tournament) throw new DraftServiceError("Tournament not found.");
      if (tournament.createdById !== params.actorUserId) {
        throw new DraftServiceError("Only the tournament admin can open a lot.");
      }
      assertLiveAuctionTournament(tournament);

      const openLot = await tx.auctionLot.findFirst({
        where: { tournamentId: tournament.id, status: AuctionLotStatus.OPEN },
        select: { id: true },
      });
      if (openLot) {
        throw new DraftServiceError(
          "Another lot is still open. Close it (sold/unsold) before opening the next one.",
        );
      }

      const player = await tx.player.findFirst({
        where: {
          id: params.playerId,
          tournamentId: tournament.id,
          deletedAt: null,
        },
        include: { rosterCategory: { select: { name: true } } },
      });
      if (!player) throw new DraftServiceError("Player not found.");
      if (player.isUnavailable) throw new DraftServiceError("Player is unavailable.");
      if (player.isLocked) throw new DraftServiceError("Player is locked.");
      if (player.linkedOwnerUserId !== null) {
        throw new DraftServiceError(
          "Roster rows tied to a franchise owner's login cannot go under the hammer.",
        );
      }
      const alreadyPicked = await tx.pick.findFirst({
        where: {
          tournamentId: tournament.id,
          playerId: player.id,
          status: PickStatus.CONFIRMED,
        },
        select: { id: true },
      });
      if (alreadyPicked) throw new DraftServiceError("Player already sold or drafted.");

      // Never open a lot at 0 (would let a player "sell" for free).
      const basePrice = Math.max(1, player.basePrice ?? tournament.auctionDefaultBasePrice);
      const lot = await tx.auctionLot.create({
        data: {
          tournamentId: tournament.id,
          playerId: player.id,
          basePrice,
          openedByUserId: params.actorUserId,
        },
      });

      await tx.draftLog.create({
        data: {
          tournamentId: tournament.id,
          action: DraftLogAction.LOT_OPENED,
          message: `${player.name} (${player.rosterCategory.name}) is under the hammer at base ${basePrice}.`,
          payload: { lotId: lot.id, playerId: player.id, basePrice } as Prisma.InputJsonValue,
          actorUserId: params.actorUserId,
        },
      });
    });
  } catch (e) {
    // The partial unique index (one OPEN lot per tournament) can race the
    // pre-check under a double-click / two admins — surface it cleanly.
    if (isUniqueViolation(e)) {
      throw new DraftServiceError(
        "Another lot is still open. Close it (sold/unsold) before opening the next one.",
      );
    }
    throw e;
  }
}

export async function placeAuctionBid(params: {
  tournamentSlug: string;
  actorUserId: string;
  lotId: string;
  amount: number;
  expectedBidCount: number;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    assertLiveAuctionTournament(tournament);

    const lot = await tx.auctionLot.findFirst({
      where: { id: params.lotId, tournamentId: tournament.id },
      include: { player: { select: { name: true, rosterCategoryId: true } } },
    });
    if (!lot) throw new DraftServiceError("Lot not found.");
    if (lot.status !== AuctionLotStatus.OPEN) {
      throw new DraftServiceError("This lot is already closed.");
    }

    // The bidder is the signed-in franchise owner; the admin bids on behalf of
    // paddle-in-the-room owners via manual assignment instead.
    const team = await tx.team.findFirst({
      where: {
        tournamentId: tournament.id,
        deletedAt: null,
        ownerUserId: params.actorUserId,
      },
    });
    if (!team) {
      throw new DraftServiceError("Only franchise owners in this tournament can bid.");
    }
    if (lot.currentBidTeamId === team.id) {
      throw new DraftServiceError("You already hold the leading bid.");
    }

    const purse = team.purseOverride ?? tournament.auctionPurse;
    const spent = await computeTeamSpentTx(tx, tournament.id, team.id);
    const rejection = validateBidAmount(params.amount, {
      currentBid: lot.currentBid,
      basePrice: lot.basePrice,
      minIncrement: tournament.auctionMinIncrement,
      purseRemaining: purse - spent,
    });
    if (rejection?.reason === "TOO_LOW") {
      throw new DraftServiceError(
        `Bid too low. The minimum acceptable bid is ${rejection.minAcceptable}.`,
      );
    }
    if (rejection?.reason === "INSUFFICIENT_PURSE") {
      throw new DraftServiceError(`Insufficient purse. You have ${rejection.purseRemaining} left.`);
    }

    if (!tournament.overrideValidation) {
      const rule = await tx.squadRule.findFirst({
        where: {
          tournamentId: tournament.id,
          rosterCategoryId: lot.player.rosterCategoryId,
          rosterCategory: { archivedAt: null },
        },
        select: { maxCount: true },
      });
      const occupancy = await countTeamCategoryOccupancyTx(
        tx,
        tournament.id,
        team.id,
        lot.player.rosterCategoryId,
      );
      if (occupancy >= (rule?.maxCount ?? 0)) {
        throw new DraftServiceError(
          "Squad rule violation: your quota for this roster group is full.",
        );
      }
    }

    // Optimistic concurrency: only land if nobody bid since we looked.
    const updated = await tx.auctionLot.updateMany({
      where: {
        id: lot.id,
        status: AuctionLotStatus.OPEN,
        bidCount: params.expectedBidCount,
      },
      data: {
        currentBid: params.amount,
        currentBidTeamId: team.id,
        bidCount: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new DraftServiceError("Another bid landed first. Check the new price and bid again.");
    }

    await tx.auctionBid.create({
      data: {
        lotId: lot.id,
        teamId: team.id,
        amount: params.amount,
        bidderUserId: params.actorUserId,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.BID_PLACED,
        message: `${team.name} bid ${params.amount} for ${lot.player.name}.`,
        payload: {
          lotId: lot.id,
          teamId: team.id,
          amount: params.amount,
        } as Prisma.InputJsonValue,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function closeAuctionLot(params: {
  tournamentSlug: string;
  actorUserId: string;
  lotId: string;
  outcome: "SOLD" | "UNSOLD" | "CANCELLED";
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: {
        teams: { where: { deletedAt: null }, select: { id: true, name: true, ownerUserId: true } },
      },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only the tournament admin can close a lot.");
    }
    if (tournament.allocationMethod !== AllocationMethod.LIVE_AUCTION) {
      throw new DraftServiceError("This tournament is not running a live auction.");
    }

    const lot = await tx.auctionLot.findFirst({
      where: { id: params.lotId, tournamentId: tournament.id },
      include: { player: { select: { name: true } } },
    });
    if (!lot) throw new DraftServiceError("Lot not found.");
    if (lot.status !== AuctionLotStatus.OPEN) {
      throw new DraftServiceError("This lot is already closed.");
    }

    const now = new Date();

    if (params.outcome === "SOLD") {
      if (lot.currentBid === null || lot.currentBidTeamId === null) {
        throw new DraftServiceError("No bids on this lot. Mark it unsold instead.");
      }
      // Defense-in-depth: re-check the winning team can still afford the bid at
      // close time (purse/overrides could have changed since the bid landed).
      const winningTeam = tournament.teams.find((t) => t.id === lot.currentBidTeamId);
      const purse =
        (
          await tx.team.findFirst({
            where: { id: lot.currentBidTeamId, tournamentId: tournament.id },
            select: { purseOverride: true },
          })
        )?.purseOverride ?? tournament.auctionPurse;
      const spent = await computeTeamSpentTx(tx, tournament.id, lot.currentBidTeamId);
      if (lot.currentBid > purse - spent) {
        throw new DraftServiceError(
          `${winningTeam?.name ?? "That team"} can no longer afford ${lot.currentBid} (only ${purse - spent} left). Reopen or adjust before selling.`,
        );
      }
      const confirmedCount = await tx.pick.count({
        where: { tournamentId: tournament.id, status: PickStatus.CONFIRMED },
      });
      await tx.pick.create({
        data: {
          tournamentId: tournament.id,
          playerId: lot.playerId,
          teamId: lot.currentBidTeamId,
          slotIndex: confirmedCount,
          status: PickStatus.CONFIRMED,
          price: lot.currentBid,
          confirmedByUserId: params.actorUserId,
        },
      });
      await tx.auctionLot.update({
        where: { id: lot.id },
        data: {
          status: AuctionLotStatus.SOLD,
          finalPrice: lot.currentBid,
          winningTeamId: lot.currentBidTeamId,
          closedAt: now,
        },
      });
      const winner = tournament.teams.find((t) => t.id === lot.currentBidTeamId);
      await tx.draftLog.create({
        data: {
          tournamentId: tournament.id,
          action: DraftLogAction.LOT_SOLD,
          message: `SOLD! ${lot.player.name} goes to ${winner?.name ?? "a team"} for ${lot.currentBid}.`,
          payload: {
            lotId: lot.id,
            playerId: lot.playerId,
            teamId: lot.currentBidTeamId,
            price: lot.currentBid,
          } as Prisma.InputJsonValue,
          actorUserId: params.actorUserId,
        },
      });

      // Auto-complete when every roster slot in the tournament is occupied.
      const ownerUserIds = tournament.teams
        .map((t) => t.ownerUserId)
        .filter((id): id is string => Boolean(id));
      const stubCount = ownerUserIds.length
        ? await tx.player.count({
            where: {
              tournamentId: tournament.id,
              deletedAt: null,
              linkedOwnerUserId: { in: ownerUserIds },
            },
          })
        : 0;
      const occupied = confirmedCount + 1 + stubCount;
      const capacity = tournament.teams.length * tournament.picksPerTeam;
      if (capacity > 0 && occupied >= capacity) {
        await tx.tournament.update({
          where: { id: tournament.id },
          data: { draftPhase: DraftPhase.COMPLETED, draftEndedAt: now },
        });
        await tx.draftLog.create({
          data: {
            tournamentId: tournament.id,
            action: DraftLogAction.DRAFT_ENDED,
            message: "All squads are full. Auction complete.",
            actorUserId: params.actorUserId,
          },
        });
      }
      return;
    }

    await tx.auctionLot.update({
      where: { id: lot.id },
      data: {
        status: params.outcome === "UNSOLD" ? AuctionLotStatus.UNSOLD : AuctionLotStatus.CANCELLED,
        closedAt: now,
      },
    });
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action:
          params.outcome === "UNSOLD" ? DraftLogAction.LOT_UNSOLD : DraftLogAction.LOT_CANCELLED,
        message:
          params.outcome === "UNSOLD"
            ? `${lot.player.name} goes unsold, back in the pool for a later round.`
            : `Lot for ${lot.player.name} was cancelled.`,
        payload: { lotId: lot.id, playerId: lot.playerId } as Prisma.InputJsonValue,
        actorUserId: params.actorUserId,
      },
    });
  });
}

/** Purse standings for every team in a LIVE_AUCTION tournament. */
export async function computePurseStates(tournamentId: string): Promise<TeamPurseState[]> {
  const [tournament, teams, spentRows] = await Promise.all([
    prisma.tournament.findFirst({
      where: { id: tournamentId, deletedAt: null },
      select: { auctionPurse: true },
    }),
    prisma.team.findMany({
      where: { tournamentId, deletedAt: null },
      select: { id: true, purseOverride: true },
    }),
    prisma.pick.groupBy({
      by: ["teamId"],
      where: {
        tournamentId,
        status: PickStatus.CONFIRMED,
        price: { not: null },
      },
      _sum: { price: true },
    }),
  ]);
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  const spentByTeam = new Map(spentRows.map((row) => [row.teamId, row._sum.price ?? 0]));
  return teams.map((team) => {
    const purse = team.purseOverride ?? tournament.auctionPurse;
    const spent = spentByTeam.get(team.id) ?? 0;
    return { teamId: team.id, purse, spent, remaining: purse - spent };
  });
}
