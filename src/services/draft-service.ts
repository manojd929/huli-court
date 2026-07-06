import {
  AllocationMethod,
  AuctionLotStatus,
  DraftLogAction,
  DraftPhase,
  PickStatus,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuctionSnapshotDto, DraftSnapshotDto } from "@/types/draft";
import { buildSnakeDraftTeamSequence, shuffleTeamIds } from "@/utils/draft-order";
import { syncOwnerPlayersForTournament } from "@/services/tournament-service";

export class DraftServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftServiceError";
  }
}

async function appendLog(params: {
  tournamentId: string;
  action: (typeof DraftLogAction)[keyof typeof DraftLogAction];
  message?: string;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
}) {
  await prisma.draftLog.create({
    data: {
      tournamentId: params.tournamentId,
      action: params.action,
      message: params.message,
      payload: params.payload as Prisma.InputJsonValue | undefined,
      actorUserId: params.actorUserId ?? undefined,
    },
  });
}

async function countOwnerOccupiedSlotsTx(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<number> {
  const teams = await tx.team.findMany({
    where: { tournamentId, deletedAt: null, ownerUserId: { not: null } },
    select: { ownerUserId: true },
  });
  const ownerUserIds = teams
    .map((team) => team.ownerUserId)
    .filter((ownerUserId): ownerUserId is string => Boolean(ownerUserId));

  if (ownerUserIds.length === 0) {
    return 0;
  }

  return tx.player.count({
    where: {
      tournamentId,
      deletedAt: null,
      linkedOwnerUserId: { in: ownerUserIds },
    },
  });
}

export async function assertTournamentAdmin(
  tournamentId: string,
  userId: string,
): Promise<void> {
  const t = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { createdById: true },
  });
  if (!t) throw new DraftServiceError("Tournament not found.");
  if (t.createdById !== userId) {
    throw new DraftServiceError("Only the tournament admin can perform this action.");
  }
}

/** Tournament row used to build auction snapshots; spotlight category resolved without a Tournament-side relation include (avoids Prisma validation errors when the generated client was not regenerated after adding the FK). */
async function loadDraftTournamentBySlug(slug: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug, deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
      players: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        include: {
          rosterCategory: {
            select: { id: true, name: true, colorHex: true },
          },
        },
      },
      squadRules: {
        where: { rosterCategory: { archivedAt: null } },
        include: {
          rosterCategory: { select: { id: true, name: true, colorHex: true } },
        },
      },
      draftSlots: { orderBy: { slotIndex: "asc" } },
      picks: {
        where: { status: PickStatus.CONFIRMED },
        orderBy: { slotIndex: "asc" },
      },
    },
  });
  if (!tournament) return null;

  let activeAuctionRosterCategory: {
    id: string;
    name: string;
    colorHex: string | null;
    archivedAt: Date | null;
  } | null = null;

  if (tournament.activeAuctionRosterCategoryId) {
    activeAuctionRosterCategory = await prisma.rosterCategory.findFirst({
      where: {
        id: tournament.activeAuctionRosterCategoryId,
        tournamentId: tournament.id,
      },
      select: {
        id: true,
        name: true,
        colorHex: true,
        archivedAt: true,
      },
    });
  }

  return { ...tournament, activeAuctionRosterCategory };
}

async function buildAuctionSnapshot(
  t: NonNullable<Awaited<ReturnType<typeof loadDraftTournamentBySlug>>>,
): Promise<AuctionSnapshotDto> {
  const [openLot, unsoldLots] = await Promise.all([
    prisma.auctionLot.findFirst({
      where: { tournamentId: t.id, status: AuctionLotStatus.OPEN },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auctionLot.findMany({
      where: { tournamentId: t.id, status: AuctionLotStatus.UNSOLD },
      select: { playerId: true },
      distinct: ["playerId"],
    }),
  ]);

  const spentByTeam = new Map<string, number>();
  for (const pick of t.picks) {
    if (pick.price !== null) {
      spentByTeam.set(
        pick.teamId,
        (spentByTeam.get(pick.teamId) ?? 0) + pick.price,
      );
    }
  }
  const soldPlayerIds = new Set(t.picks.map((p) => p.playerId));

  return {
    minIncrement: t.auctionMinIncrement,
    defaultBasePrice: t.auctionDefaultBasePrice,
    purses: t.teams.map((team) => {
      const purse = team.purseOverride ?? t.auctionPurse;
      const spent = spentByTeam.get(team.id) ?? 0;
      return { teamId: team.id, purse, spent, remaining: purse - spent };
    }),
    currentLot: openLot
      ? {
          lotId: openLot.id,
          playerId: openLot.playerId,
          basePrice: openLot.basePrice,
          currentBid: openLot.currentBid,
          currentBidTeamId: openLot.currentBidTeamId,
          bidCount: openLot.bidCount,
          openedAt: openLot.createdAt.toISOString(),
        }
      : null,
    unsoldPlayerIds: unsoldLots
      .map((lot) => lot.playerId)
      .filter((playerId) => !soldPlayerIds.has(playerId)),
  };
}

function mapSnapshot(t: NonNullable<Awaited<ReturnType<typeof loadDraftTournamentBySlug>>>): DraftSnapshotDto {
  const playerAssignments = new Map<
    string,
    { teamId: string; confirmed: boolean }
  >();
  const ownerTeamIdsByUserId = new Map<string, string>();
  for (const team of t.teams) {
    if (team.ownerUserId) {
      ownerTeamIdsByUserId.set(team.ownerUserId, team.id);
    }
  }
  for (const pick of t.picks) {
    playerAssignments.set(pick.playerId, {
      teamId: pick.teamId,
      confirmed: pick.status === PickStatus.CONFIRMED,
    });
  }
  if (t.pendingPickPlayerId && t.pendingPickTeamId) {
    if (!playerAssignments.has(t.pendingPickPlayerId)) {
      playerAssignments.set(t.pendingPickPlayerId, {
        teamId: t.pendingPickTeamId,
        confirmed: false,
      });
    }
  }

  const lastPick = [...t.picks]
    .filter((p) => p.status === PickStatus.CONFIRMED)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  const lastTeam = lastPick
    ? t.teams.find((team) => team.id === lastPick.teamId)
    : undefined;
  const lastPlayer = lastPick
    ? t.players.find((pl) => pl.id === lastPick.playerId)
    : undefined;

  const spotlightCategoryId = getEffectiveAuctionSpotlightCategoryId({
    activeAuctionRosterCategoryId: t.activeAuctionRosterCategoryId,
    activeAuctionRosterCategory: t.activeAuctionRosterCategory,
  });
  const spotlightMeta =
    spotlightCategoryId !== null &&
    t.activeAuctionRosterCategory &&
    t.activeAuctionRosterCategory.id === spotlightCategoryId
      ? t.activeAuctionRosterCategory
      : null;
  const ownerOccupiedSlots = t.players.filter((player) => {
    if (!player.linkedOwnerUserId) {
      return false;
    }
    return ownerTeamIdsByUserId.has(player.linkedOwnerUserId);
  }).length;
  const confirmedPickCount = t.picks.filter((p) => p.status === PickStatus.CONFIRMED).length;

  const soldPriceByPlayer = new Map<string, number>();
  for (const pick of t.picks) {
    if (pick.price !== null) soldPriceByPlayer.set(pick.playerId, pick.price);
  }

  return {
    tournamentId: t.id,
    slug: t.slug,
    name: t.name,
    draftPhase: t.draftPhase,
    allocationMethod: t.allocationMethod,
    auction: null,
    currentSlotIndex: t.currentSlotIndex,
    picksPerTeam: t.picksPerTeam,
    draftOrderLocked: t.draftOrderLocked,
    overrideValidation: t.overrideValidation,
    pickTimerSeconds: t.pickTimerSeconds,
    auctionSpotlightRosterCategoryId: spotlightMeta?.id ?? null,
    auctionSpotlightRosterCategoryName: spotlightMeta?.name ?? null,
    auctionSpotlightRosterCategoryColorHex: spotlightMeta?.colorHex ?? null,
    pendingPickPlayerId: t.pendingPickPlayerId,
    pendingPickTeamId: t.pendingPickTeamId,
    teams: t.teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      logoUrl: team.logoUrl,
      colorHex: team.colorHex,
      ownerUserId: team.ownerUserId,
    })),
    players: t.players.map((player) => {
      const assignment = playerAssignments.get(player.id);
      const ownerTeamId = player.linkedOwnerUserId
        ? ownerTeamIdsByUserId.get(player.linkedOwnerUserId) ?? null
        : null;
      return {
        id: player.id,
        name: player.name,
        photoUrl: player.photoUrl,
        rosterCategoryId: player.rosterCategoryId,
        rosterCategoryName: player.rosterCategory.name,
        rosterCategoryColorHex: player.rosterCategory.colorHex,
        gender: player.gender,
        notes: player.notes,
        isUnavailable: player.isUnavailable,
        isLocked: player.isLocked,
        runsFranchiseLogin: player.linkedOwnerUserId !== null,
        assignedTeamId: assignment?.teamId ?? ownerTeamId,
        hasConfirmedPick: assignment?.confirmed ?? Boolean(ownerTeamId),
        soldPrice: soldPriceByPlayer.get(player.id) ?? null,
      };
    }),
    draftSlots: t.draftSlots.map((slot) => ({
      slotIndex: slot.slotIndex,
      teamId: slot.teamId,
    })),
    squadRules: t.squadRules.map((rule) => ({
      rosterCategoryId: rule.rosterCategoryId,
      rosterCategoryName: rule.rosterCategory.name,
      rosterCategoryColorHex: rule.rosterCategory.colorHex,
      maxCount: rule.maxCount,
    })),
    picksCount: confirmedPickCount + ownerOccupiedSlots,
    draftSlotsTotal: t.draftSlots.length,
    activity: [],
    lastConfirmedPick:
      lastPick && lastTeam && lastPlayer && lastPlayer.rosterCategory
        ? {
            playerName: lastPlayer.name,
            teamName: lastTeam.name,
            rosterCategoryName: lastPlayer.rosterCategory.name,
            rosterCategoryColorHex: lastPlayer.rosterCategory.colorHex,
          }
        : null,
  };
}

export async function fetchDraftSnapshotBySlug(
  slug: string,
): Promise<DraftSnapshotDto | null> {
  const tournament = await loadDraftTournamentBySlug(slug);
  if (!tournament) return null;
  const logs = await prisma.draftLog.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      action: true,
      message: true,
      createdAt: true,
    },
  });
  const snap = mapSnapshot(tournament);
  if (tournament.allocationMethod === AllocationMethod.LIVE_AUCTION) {
    snap.auction = await buildAuctionSnapshot(tournament);
  }
  snap.activity = logs.map((log) => ({
    id: log.id,
    action: log.action,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
  }));
  return snap;
}

function assertPhase(
  phase: (typeof DraftPhase)[keyof typeof DraftPhase],
  allowed: (typeof DraftPhase)[keyof typeof DraftPhase][],
) {
  if (!allowed.includes(phase)) {
    throw new DraftServiceError("Draft is not in the correct state for this action.");
  }
}

function getCurrentTurnTeamId(
  tournament: {
    currentSlotIndex: number;
    draftSlots: { slotIndex: number; teamId: string }[];
  },
): string | null {
  const slot = tournament.draftSlots.find(
    (s) => s.slotIndex === tournament.currentSlotIndex,
  );
  return slot?.teamId ?? null;
}

async function countTeamCategoryPicks(
  tournamentId: string,
  teamId: string,
): Promise<Record<string, number>> {
  const [picks, team] = await Promise.all([
    prisma.pick.findMany({
      where: {
        tournamentId,
        teamId,
        status: PickStatus.CONFIRMED,
      },
      select: {
        player: { select: { rosterCategoryId: true } },
      },
    }),
    prisma.team.findFirst({
      where: {
        id: teamId,
        tournamentId,
        deletedAt: null,
      },
      select: { ownerUserId: true },
    }),
  ]);
  const counts: Record<string, number> = {};
  for (const pick of picks) {
    const cid = pick.player.rosterCategoryId;
    counts[cid] = (counts[cid] ?? 0) + 1;
  }

  if (team?.ownerUserId) {
    const ownerRows = await prisma.player.findMany({
      where: {
        tournamentId,
        deletedAt: null,
        linkedOwnerUserId: team.ownerUserId,
      },
      select: { rosterCategoryId: true },
    });
    for (const ownerRow of ownerRows) {
      counts[ownerRow.rosterCategoryId] = (counts[ownerRow.rosterCategoryId] ?? 0) + 1;
    }
  }

  return counts;
}

function getEffectiveAuctionSpotlightCategoryId(args: {
  activeAuctionRosterCategoryId: string | null;
  activeAuctionRosterCategory: {
    archivedAt: Date | null;
  } | null;
}): string | null {
  if (
    !args.activeAuctionRosterCategoryId ||
    args.activeAuctionRosterCategory === null ||
    args.activeAuctionRosterCategory.archivedAt !== null
  ) {
    return null;
  }
  return args.activeAuctionRosterCategoryId;
}

async function validatePickAllowed(params: {
  tournamentId: string;
  teamId: string;
  playerId: string;
  overrideValidation: boolean;
}) {
  const spotlightTournament = await prisma.tournament.findFirst({
    where: { id: params.tournamentId, deletedAt: null },
    select: { activeAuctionRosterCategoryId: true },
  });
  const spotlightFk = spotlightTournament?.activeAuctionRosterCategoryId ?? null;
  let spotlightCategoryRow: { archivedAt: Date | null } | null = null;
  if (spotlightFk !== null) {
    spotlightCategoryRow = await prisma.rosterCategory.findFirst({
      where: {
        id: spotlightFk,
        tournamentId: params.tournamentId,
      },
      select: { archivedAt: true },
    });
  }

  const player = await prisma.player.findFirst({
    where: {
      id: params.playerId,
      tournamentId: params.tournamentId,
      deletedAt: null,
    },
  });
  if (!player) throw new DraftServiceError("Player not found.");
  if (player.isUnavailable) throw new DraftServiceError("Player is unavailable.");
  if (player.isLocked) throw new DraftServiceError("Player is locked.");

  const existing = await prisma.pick.findFirst({
    where: {
      tournamentId: params.tournamentId,
      playerId: params.playerId,
      status: PickStatus.CONFIRMED,
    },
  });
  if (existing) throw new DraftServiceError("Player already drafted.");

  if (player.linkedOwnerUserId !== null) {
    throw new DraftServiceError(
      "Roster rows tied to another franchise owner's login cannot be drafted in the auction.",
    );
  }

  if (params.overrideValidation) return;

  const spotlightId = getEffectiveAuctionSpotlightCategoryId({
    activeAuctionRosterCategoryId: spotlightFk,
    activeAuctionRosterCategory: spotlightCategoryRow,
  });
  if (spotlightId && player.rosterCategoryId !== spotlightId) {
    throw new DraftServiceError(
      "This auction spotlight is restricted to another roster group. Change the LIVE round spotlight or temporarily enable rules override to proceed.",
    );
  }

  const rules = await prisma.squadRule.findMany({
    where: {
      tournamentId: params.tournamentId,
      rosterCategory: { archivedAt: null },
    },
  });
  const counts = await countTeamCategoryPicks(params.tournamentId, params.teamId);
  const rosterCategoryId = player.rosterCategoryId;
  const rule = rules.find((r) => r.rosterCategoryId === rosterCategoryId);
  const max = rule?.maxCount ?? 0;
  if ((counts[rosterCategoryId] ?? 0) >= max) {
    throw new DraftServiceError(
      "Squad rule violation: category quota reached for this team.",
    );
  }
}

export async function randomizeDraftOrder(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: {
        teams: { where: { deletedAt: null } },
        draftSlots: true,
      },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only the tournament admin can randomize order.");
    }
    assertPhase(tournament.draftPhase, [
      DraftPhase.SETUP,
      DraftPhase.READY,
    ]);
    if (tournament.draftOrderLocked) {
      throw new DraftServiceError("Draft order is locked.");
    }
    if (tournament.teams.length === 0) {
      throw new DraftServiceError("Add teams before generating draft order.");
    }

    const shuffled = shuffleTeamIds(tournament.teams.map((team) => team.id));
    const sequence = buildSnakeDraftTeamSequence(
      shuffled,
      tournament.picksPerTeam,
    );

    await tx.draftOrderSlot.deleteMany({
      where: { tournamentId: tournament.id },
    });
    await tx.draftOrderSlot.createMany({
      data: sequence.map((teamId, index) => ({
        tournamentId: tournament.id,
        slotIndex: index,
        teamId,
      })),
    });

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        currentSlotIndex: 0,
        draftPhase: DraftPhase.READY,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.ORDER_RANDOMIZED,
        message: "Draft order randomized round by round.",
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function startDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournamentPreview = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
    select: { id: true },
  });
  if (!tournamentPreview) throw new DraftServiceError("Tournament not found.");
  await syncOwnerPlayersForTournament(tournamentPreview.id);

  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only the tournament admin can start the draft.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.READY, DraftPhase.SETUP]);
    if (tournament.allocationMethod === AllocationMethod.RANDOM_ASSIGNMENT) {
      throw new DraftServiceError(
        "This tournament uses random assignment — run it from the admin desk instead of starting a live draft.",
      );
    }
    const isAuction =
      tournament.allocationMethod === AllocationMethod.LIVE_AUCTION;
    if (!isAuction && tournament.draftSlots.length === 0) {
      throw new DraftServiceError("Generate draft order before starting.");
    }
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        draftPhase: DraftPhase.LIVE,
        draftStartedAt: tournament.draftStartedAt ?? new Date(),
        currentSlotIndex: isAuction
          ? tournament.currentSlotIndex
          : Math.min(
              tournament.currentSlotIndex,
              tournament.draftSlots.length - 1,
            ),
      },
    });
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.DRAFT_STARTED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function pauseDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.PAUSED },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_PAUSED,
    actorUserId: params.actorUserId,
  });
}

export async function resumeDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [DraftPhase.PAUSED]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.LIVE },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_RESUMED,
    actorUserId: params.actorUserId,
  });
}

export async function setAuctionSpotlightCategory(params: {
  tournamentSlug: string;
  actorUserId: string;
  rosterCategoryId: string | null;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  if (tournament.createdById !== params.actorUserId) {
    throw new DraftServiceError(
      "Only tournament admin can set the LIVE roster spotlight.",
    );
  }
  assertPhase(tournament.draftPhase, [
    DraftPhase.SETUP,
    DraftPhase.READY,
    DraftPhase.LIVE,
    DraftPhase.PAUSED,
    DraftPhase.FROZEN,
  ]);

  const nextSpotlightId = params.rosterCategoryId;
  let categoryLabel: string | null = null;
  if (nextSpotlightId !== null) {
    const cat = await prisma.rosterCategory.findFirst({
      where: {
        id: nextSpotlightId,
        tournamentId: tournament.id,
        archivedAt: null,
      },
      select: { name: true },
    });
    if (!cat) {
      throw new DraftServiceError("Roster group not found or is archived.");
    }
    categoryLabel = cat.name;
  }

  const prevId = tournament.activeAuctionRosterCategoryId ?? null;
  const nextId = nextSpotlightId ?? null;
  if (prevId === nextId) return;

  await prisma.$transaction(async (tx) => {
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        activeAuctionRosterCategoryId: nextId,
        pendingPickPlayerId: null,
        pendingPickTeamId: null,
        pendingIdempotencyKey: null,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.AUCTION_FOCUS_CATEGORY,
        message:
          nextId === null
            ? "Spotlight cleared — owners can nominate from any roster group."
            : `Spotlight locked to roster group "${categoryLabel ?? "Unknown"}". Owners only see nominees in this group.`,
        actorUserId: params.actorUserId,
        payload:
          nextId === null ? undefined : { rosterCategoryId: nextId } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function freezeDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [
    DraftPhase.LIVE,
    DraftPhase.PAUSED,
  ]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.FROZEN },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_FROZEN,
    actorUserId: params.actorUserId,
  });
}

export async function unlockDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [DraftPhase.FROZEN, DraftPhase.LOCKED]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.LIVE },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_UNLOCKED,
    actorUserId: params.actorUserId,
  });
}

export async function lockDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  assertPhase(tournament.draftPhase, [
    DraftPhase.LIVE,
    DraftPhase.PAUSED,
    DraftPhase.FROZEN,
  ]);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { draftPhase: DraftPhase.LOCKED },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_LOCKED,
    actorUserId: params.actorUserId,
  });
}

export async function endDraft(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      draftPhase: DraftPhase.COMPLETED,
      draftEndedAt: new Date(),
      activeAuctionRosterCategoryId: null,
      pendingPickPlayerId: null,
      pendingPickTeamId: null,
      pendingIdempotencyKey: null,
    },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.DRAFT_ENDED,
    actorUserId: params.actorUserId,
  });
}

export async function nextTurn(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can advance turns.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
    if (tournament.pendingPickPlayerId) {
      throw new DraftServiceError("Confirm or clear the pending pick first.");
    }
    const nextIndex = tournament.currentSlotIndex + 1;
    if (nextIndex >= tournament.draftSlots.length) {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          draftPhase: DraftPhase.COMPLETED,
          draftEndedAt: new Date(),
        },
      });
    } else {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { currentSlotIndex: nextIndex },
      });
    }
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.TURN_ADVANCED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function skipTurn(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can skip turns.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
    if (tournament.pendingPickPlayerId) {
      throw new DraftServiceError("Confirm or clear the pending pick before skipping.");
    }
    const nextIndex = tournament.currentSlotIndex + 1;
    if (nextIndex >= tournament.draftSlots.length) {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          draftPhase: DraftPhase.COMPLETED,
          draftEndedAt: new Date(),
        },
      });
    } else {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { currentSlotIndex: nextIndex },
      });
    }
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.TURN_SKIPPED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function previousTurn(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can rewind turns.");
    }
    if (tournament.currentSlotIndex <= 0) return;
    await tx.tournament.update({
      where: { id: tournament.id },
      data: { currentSlotIndex: tournament.currentSlotIndex - 1 },
    });
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.TURN_REVERTED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function requestPick(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  idempotencyKey: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);

    const currentTeamId = getCurrentTurnTeamId(tournament);
    if (!currentTeamId) throw new DraftServiceError("Invalid draft slot.");

    const isAdmin = tournament.createdById === params.actorUserId;
    const team = tournament.draftSlots.length
      ? await tx.team.findFirst({
          where: { id: currentTeamId },
        })
      : null;
    const isOwner = team?.ownerUserId === params.actorUserId;
    if (!isAdmin && !isOwner) {
      throw new DraftServiceError("Only the active franchise owner (or admin) can nominate a pick.");
    }

    if (
      isOwner &&
      tournament.pendingPickPlayerId !== null &&
      tournament.pendingPickTeamId === currentTeamId
    ) {
      const samePendingRequest =
        tournament.pendingIdempotencyKey === params.idempotencyKey &&
        tournament.pendingPickPlayerId === params.playerId;
      if (!samePendingRequest) {
        throw new DraftServiceError(
          "Your nomination is already waiting for admin review. Wait for confirmation or decline before picking another player.",
        );
      }
    }

    if (
      tournament.pendingIdempotencyKey === params.idempotencyKey &&
      tournament.pendingPickPlayerId === params.playerId &&
      tournament.pendingPickTeamId === currentTeamId
    ) {
      return;
    }

    await validatePickAllowed({
      tournamentId: tournament.id,
      teamId: currentTeamId,
      playerId: params.playerId,
      overrideValidation: tournament.overrideValidation,
    });

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        pendingPickPlayerId: params.playerId,
        pendingPickTeamId: currentTeamId,
        pendingIdempotencyKey: params.idempotencyKey,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PICK_REQUESTED,
        actorUserId: params.actorUserId,
        payload: { playerId: params.playerId } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function confirmPick(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can confirm picks.");
    }
    assertPhase(tournament.draftPhase, [DraftPhase.LIVE]);
    if (
      !tournament.pendingPickPlayerId ||
      !tournament.pendingPickTeamId
    ) {
      throw new DraftServiceError("No pending pick to confirm.");
    }

    const currentTeamId = getCurrentTurnTeamId(tournament);
    if (
      currentTeamId &&
      tournament.pendingPickTeamId !== currentTeamId &&
      !tournament.overrideValidation
    ) {
      throw new DraftServiceError("Pending pick does not match current turn.");
    }

    const slotIndex = tournament.currentSlotIndex;

    await validatePickAllowed({
      tournamentId: tournament.id,
      teamId: tournament.pendingPickTeamId,
      playerId: tournament.pendingPickPlayerId,
      overrideValidation: tournament.overrideValidation,
    });

    await tx.pick.create({
      data: {
        tournamentId: tournament.id,
        playerId: tournament.pendingPickPlayerId,
        teamId: tournament.pendingPickTeamId,
        slotIndex,
        status: PickStatus.CONFIRMED,
        idempotencyKey: tournament.pendingIdempotencyKey,
        confirmedByUserId: params.actorUserId,
      },
    });

    const [ownerOccupiedSlots, confirmedPicksAfterUpdate] = await Promise.all([
      countOwnerOccupiedSlotsTx(tx, tournament.id),
      tx.pick.count({
        where: {
          tournamentId: tournament.id,
          status: PickStatus.CONFIRMED,
        },
      }),
    ]);
    const occupiedSlotsAfterUpdate = ownerOccupiedSlots + confirmedPicksAfterUpdate;
    const nextIndex = tournament.currentSlotIndex + 1;
    const completed = occupiedSlotsAfterUpdate >= tournament.draftSlots.length;

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        pendingPickPlayerId: null,
        pendingPickTeamId: null,
        pendingIdempotencyKey: null,
        currentSlotIndex: completed
          ? tournament.currentSlotIndex
          : nextIndex,
        draftPhase: completed ? DraftPhase.COMPLETED : DraftPhase.LIVE,
        draftEndedAt: completed ? new Date() : tournament.draftEndedAt,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PICK_CONFIRMED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function undoLastPick(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can undo picks.");
    }

    if (tournament.pendingPickPlayerId) {
      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          pendingPickPlayerId: null,
          pendingPickTeamId: null,
          pendingIdempotencyKey: null,
        },
      });
      await tx.draftLog.create({
        data: {
          tournamentId: tournament.id,
          action: DraftLogAction.PICK_UNDONE,
          message: "Cleared pending nomination.",
          actorUserId: params.actorUserId,
        },
      });
      return;
    }

    const lastPick = await tx.pick.findFirst({
      where: {
        tournamentId: tournament.id,
        status: PickStatus.CONFIRMED,
      },
      orderBy: { slotIndex: "desc" },
    });
    if (!lastPick) return;

    await tx.pick.delete({ where: { id: lastPick.id } });
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        currentSlotIndex: lastPick.slotIndex,
        draftPhase: DraftPhase.LIVE,
        draftEndedAt: null,
      },
    });
    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PICK_UNDONE,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function toggleOverrideValidation(params: {
  tournamentSlug: string;
  actorUserId: string;
  enabled: boolean;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { overrideValidation: params.enabled },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.OVERRIDE_VALIDATION,
    message: params.enabled ? "Validation override ON" : "Validation override OFF",
    actorUserId: params.actorUserId,
  });
}

export async function forceSyncLog(params: {
  tournamentSlug: string;
  actorUserId: string;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.SYNC_FORCED,
    actorUserId: params.actorUserId,
  });
}

export async function assignManualPick(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  teamId: string;
  idempotencyKey: string;
}) {
  await prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: { draftSlots: true },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only admin can manually assign.");
    }
    assertPhase(tournament.draftPhase, [
      DraftPhase.LIVE,
      DraftPhase.PAUSED,
      DraftPhase.FROZEN,
    ]);

    const existingKey = await tx.pick.findFirst({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existingKey) return;

    await validatePickAllowed({
      tournamentId: tournament.id,
      teamId: params.teamId,
      playerId: params.playerId,
      overrideValidation: tournament.overrideValidation,
    });

    const slotIndex =
      tournament.draftSlots.length > 0
        ? Math.min(
            tournament.currentSlotIndex,
            tournament.draftSlots.length - 1,
          )
        : 0;

    await tx.pick.create({
      data: {
        tournamentId: tournament.id,
        playerId: params.playerId,
        teamId: params.teamId,
        slotIndex,
        status: PickStatus.CONFIRMED,
        idempotencyKey: params.idempotencyKey,
        confirmedByUserId: params.actorUserId,
      },
    });

    const [ownerOccupiedSlots, confirmedPicksAfterUpdate] = await Promise.all([
      countOwnerOccupiedSlotsTx(tx, tournament.id),
      tx.pick.count({
        where: {
          tournamentId: tournament.id,
          status: PickStatus.CONFIRMED,
        },
      }),
    ]);
    const occupiedSlotsAfterUpdate = ownerOccupiedSlots + confirmedPicksAfterUpdate;
    const nextIndex = tournament.currentSlotIndex + 1;
    const completed =
      tournament.draftSlots.length > 0 &&
      occupiedSlotsAfterUpdate >= tournament.draftSlots.length;

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        pendingPickPlayerId: null,
        pendingPickTeamId: null,
        pendingIdempotencyKey: null,
        currentSlotIndex: completed
          ? tournament.currentSlotIndex
          : nextIndex,
        draftPhase: completed ? DraftPhase.COMPLETED : tournament.draftPhase,
        draftEndedAt: completed ? new Date() : tournament.draftEndedAt,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.PLAYER_ASSIGNED,
        actorUserId: params.actorUserId,
      },
    });
  });
}

export async function markPlayerUnavailable(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  unavailable: boolean;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.player.updateMany({
    where: {
      id: params.playerId,
      tournamentId: tournament.id,
    },
    data: { isUnavailable: params.unavailable },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.PLAYER_UNAVAILABLE,
    actorUserId: params.actorUserId,
  });
}

export async function markPlayerLocked(params: {
  tournamentSlug: string;
  actorUserId: string;
  playerId: string;
  locked: boolean;
}) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
  });
  if (!tournament) throw new DraftServiceError("Tournament not found.");
  await assertTournamentAdmin(tournament.id, params.actorUserId);
  await prisma.player.updateMany({
    where: {
      id: params.playerId,
      tournamentId: tournament.id,
    },
    data: { isLocked: params.locked },
  });
  await appendLog({
    tournamentId: tournament.id,
    action: DraftLogAction.PLAYER_LOCKED,
    actorUserId: params.actorUserId,
  });
}
