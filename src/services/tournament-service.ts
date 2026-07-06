import { z } from "zod";

import { DraftPhase, Gender } from "@/generated/prisma/enums";
import { UserRole } from "@/generated/prisma/enums";
import { wholeRupeesToInrMinorUnits } from "@/lib/currency/player-entry-fee";
import { tournamentDashboardListSelect } from "@/lib/data/tournament-dashboard-list-select";
import {
  computePerTeamCategoryCaps,
  rosterCategoryOrderIds,
} from "@/lib/squad-rules/compute-per-team-caps";
import {
  ADMIN_FRANCHISE_OWNER_AUTH_UNAVAILABLE,
  franchiseOwnerAuthRemovalFaultUserMessage,
} from "@/lib/errors/safe-user-feedback";
import {
  DEFAULT_ROSTER_CATEGORY_SQUAD_CAPS,
  isDoublesCategoryName,
} from "@/lib/roster/default-roster-category-seeds";
import { prisma } from "@/lib/prisma";
import {
  formatSquadValidationErrors,
  validateSquadRulesAgainstRoster,
} from "@/lib/squad-rules/validate-squad-rules-against-roster";
import { TEAM_OWNER_SYNC_STUB_NOTE } from "@/constants/team-owner-player";
import { DEFAULT_PICKS_PER_TEAM } from "@/constants/tournament-defaults";
import { buildFranchiseOwnerAssigneeList } from "@/lib/data/franchise-owner-assignees";
import { deleteAuthUserIfNoOwnerReferences } from "@/services/franchise-owner-auth";
import {
  ensureOrganizationForUser,
  userCanManageTournament,
} from "@/services/organization-service";
import { assertLeagueManageable } from "@/services/league-service";
import {
  resolveOwnerStubCategoryIdTx,
  seedDefaultRosterCategories,
  assertActiveRosterCategoryForPlayer,
} from "@/services/roster-category-service";
import { TournamentServiceError } from "@/services/tournament-errors";
import { tournamentSlugFromName } from "@/utils/tournament-slug";

import type {
  BulkUpdatePlayersInput,
  CreatePlayerInput,
  CreateTeamInput,
  CreateTournamentInput,
  DeletePlayerInput,
  SquadRulesInput,
  UpdatePlayerInput,
  UpdateTeamInput,
  UpdateTournamentInput,
} from "@/validations/tournament";

export { TournamentServiceError } from "@/services/tournament-errors";

async function removeFranchiseOwnerCredentialsIfOrphaned(
  userId: string,
): Promise<void> {
  try {
    await deleteAuthUserIfNoOwnerReferences(userId);
  } catch (e) {
    if (process.env.NODE_ENV !== "production" && e instanceof Error) {
      console.error("[remove-franchise-owner-credentials]", e.message);
    }
    const surfaced =
      e instanceof Error && e.message === ADMIN_FRANCHISE_OWNER_AUTH_UNAVAILABLE
        ? ADMIN_FRANCHISE_OWNER_AUTH_UNAVAILABLE
        : franchiseOwnerAuthRemovalFaultUserMessage();
    throw new TournamentServiceError(surfaced);
  }
}

async function clearFranchiseOwnerLinksWhenNoTeamOwnership(
  tournamentId: string,
  ownerUserId: string,
): Promise<void> {
  const stillOwnsTeam = await prisma.team.count({
    where: { tournamentId, deletedAt: null, ownerUserId },
  });
  if (stillOwnsTeam > 0) {
    return;
  }

  await prisma.player.updateMany({
    where: {
      tournamentId,
      deletedAt: null,
      linkedOwnerUserId: ownerUserId,
    },
    data: { linkedOwnerUserId: null },
  });
}


export async function syncOwnerPlayersForTournament(
  tournamentId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const stubCategoryId = await resolveOwnerStubCategoryIdTx(tx, tournamentId);

    const teams = await tx.team.findMany({
      where: { tournamentId, deletedAt: null },
      select: { ownerUserId: true },
    });
    const ownerIds = [
      ...new Set(
        teams.map((t) => t.ownerUserId).filter((id): id is string => Boolean(id)),
      ),
    ];

    const profiles =
      ownerIds.length > 0
        ? await tx.userProfile.findMany({
            where: { id: { in: ownerIds }, deletedAt: null },
            select: { id: true, email: true, displayName: true },
          })
        : [];

    const linkedPlayers = await tx.player.findMany({
      where: {
        tournamentId,
        deletedAt: null,
        linkedOwnerUserId: { not: null },
      },
      select: { id: true, linkedOwnerUserId: true, name: true, notes: true },
    });

    function desiredOwnerName(profile: {
      displayName: string | null;
      email: string;
    }): string {
      const fromDisplay = profile.displayName?.trim();
      if (fromDisplay) return fromDisplay;
      const local = profile.email.split("@")[0]?.trim();
      if (local) return local;
      return "Team owner";
    }

    for (const ownerId of ownerIds) {
      const profile = profiles.find((p) => p.id === ownerId);
      if (!profile) continue;

      const existing = linkedPlayers.find((p) => p.linkedOwnerUserId === ownerId);
      const name = desiredOwnerName(profile);

      if (!existing) {
        await tx.player.create({
          data: {
            tournamentId,
            name,
            photoUrl: null,
            rosterCategoryId: stubCategoryId,
            gender: Gender.MALE,
            notes: TEAM_OWNER_SYNC_STUB_NOTE,
            linkedOwnerUserId: ownerId,
          },
        });
      } else {
        await tx.player.update({
          where: { id: existing.id },
          data: {
            name,
          },
        });
      }
    }

    const staleIds = linkedPlayers
      .filter(
        (p) =>
          p.linkedOwnerUserId !== null &&
          !ownerIds.includes(p.linkedOwnerUserId) &&
          p.notes === TEAM_OWNER_SYNC_STUB_NOTE,
      )
      .map((p) => p.id);

    if (staleIds.length > 0) {
      await tx.player.updateMany({
        where: { id: { in: staleIds } },
        data: {
          deletedAt: new Date(),
          linkedOwnerUserId: null,
        },
      });
    }
  });
}

export async function createTournament(
  userId: string,
  input: CreateTournamentInput,
): Promise<{ slug: string; leagueSlug: string | null }> {
  const profile = await prisma.userProfile.findFirst({
    where: { id: userId, deletedAt: null },
    select: { role: true },
  });
  if (!profile || profile.role !== UserRole.ADMIN) {
    throw new TournamentServiceError("Only admins can create tournaments.");
  }

  const organizationId = await ensureOrganizationForUser(userId);
  const trimmedLeagueId = input.leagueId?.trim() ? input.leagueId.trim() : null;
  const leagueId = trimmedLeagueId
    ? await assertLeagueManageable(userId, trimmedLeagueId)
    : null;
  const season = input.season?.trim() ? input.season.trim() : null;
  const slug = tournamentSlugFromName(input.name);
  await prisma.$transaction(async (tx) => {
    const feeMinorUnits =
      input.playerEntryFeeRupeesWhole !== undefined &&
      input.playerEntryFeeRupeesWhole !== null &&
      input.playerEntryFeeRupeesWhole > 0
        ? wholeRupeesToInrMinorUnits(input.playerEntryFeeRupeesWhole)
        : null;
    const tournament = await tx.tournament.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        logoUrl: input.logoUrl?.trim() ? input.logoUrl.trim() : null,
        colorHex: input.colorHex?.trim() ? input.colorHex.trim() : null,
        createdById: userId,
        organizationId,
        leagueId,
        season,
        sport: input.sport ?? "BADMINTON",
        format: input.tournamentFormat ?? "DOUBLES_ONLY",
        allocationMethod: input.allocationMethod ?? "SNAKE_DRAFT",
        auctionPurse: input.auctionPurse ?? undefined,
        auctionMinIncrement: input.auctionMinIncrement ?? undefined,
        auctionDefaultBasePrice: input.auctionDefaultBasePrice ?? undefined,
        picksPerTeam: input.picksPerTeam ?? DEFAULT_PICKS_PER_TEAM,
        draftPhase: DraftPhase.SETUP,
        playerEntryFeeMinorUnits: feeMinorUnits,
        playerEntryFeeCurrencyCode: "INR",
      },
    });

    const tournamentFormat = input.tournamentFormat ?? "DOUBLES_ONLY";
    await seedDefaultRosterCategories(tx, tournament.id, tournamentFormat);
    const rosterRows = await tx.rosterCategory.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, stableKey: true },
    });
    // Default caps must be permissive (never 0): a cap of 0 blocks EVERY bid
    // and draft pick in that category out of the box. Commissioners tighten
    // caps for composition rules from the Rules page ("Auto-set from roster"
    // or manual). We fall back to picksPerTeam so no category is ever an
    // accidental hard block; legacy stable keys keep their designed caps.
    const defaultSquadCap = input.picksPerTeam ?? DEFAULT_PICKS_PER_TEAM;
    await tx.squadRule.createMany({
      data: rosterRows.map((row) => {
        let maxCount = defaultSquadCap;
        if (row.stableKey !== null) {
          const cap = DEFAULT_ROSTER_CATEGORY_SQUAD_CAPS[row.stableKey];
          if (typeof cap === "number") {
            maxCount = cap;
          }
        }
        return {
          tournamentId: tournament.id,
          rosterCategoryId: row.id,
          maxCount,
        };
      }),
    });
  });
  const leagueSlug = leagueId
    ? ((
        await prisma.league.findUnique({
          where: { id: leagueId },
          select: { slug: true },
        })
      )?.slug ?? null)
    : null;
  return { slug, leagueSlug };
}

export async function updateTournament(
  userId: string,
  input: UpdateTournamentInput,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  const data: {
    name?: string;
    logoUrl?: string | null;
    colorHex?: string | null;
  } = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.logoUrl !== undefined) {
    data.logoUrl = input.logoUrl.trim() ? input.logoUrl.trim() : null;
  }
  if (input.colorHex !== undefined) {
    data.colorHex = input.colorHex.trim() ? input.colorHex.trim() : null;
  }
  await prisma.tournament.update({
    where: { id: tournamentId },
    data,
  });
}

export async function listTournamentsForUser(userId: string) {
  return prisma.tournament.findMany({
    where: {
      deletedAt: null,
      createdById: userId,
    },
    orderBy: { updatedAt: "desc" },
    select: tournamentDashboardListSelect,
  });
}

export async function assertTournamentOwnership(slug: string, userId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, createdById: true, organizationId: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  const canManage = await userCanManageTournament(userId, tournament);
  if (!canManage) {
    throw new TournamentServiceError("You do not have access to this tournament.");
  }
  return tournament.id;
}

async function resolveTeamOwnerUserId(
  raw: string,
  commissionerUserId: string,
  tournamentId: string,
): Promise<string | null> {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = z.string().uuid().safeParse(trimmed);
  if (!parsed.success) {
    throw new TournamentServiceError(
      "Owner ID must be a valid UUID for an existing franchise-owner account. Prefer granting a login under Players instead of pasting IDs.",
    );
  }
  if (parsed.data === commissionerUserId) {
    throw new TournamentServiceError(
      "The commissioner cannot be a franchise owner. Create or invite a separate owner login.",
    );
  }
  const profile = await prisma.userProfile.findFirst({
    where: { id: parsed.data, deletedAt: null },
    select: { id: true },
  });
  if (!profile) {
    throw new TournamentServiceError(
      "No account matches that owner ID yet. Ask the franchise owner to sign in once, then assign them.",
    );
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId, deletedAt: null },
    select: { ownerUserId: true },
  });
  const existingTeamOwnerIds = teams
    .map((team) => team.ownerUserId)
    .filter((id): id is string => Boolean(id));

  const assignees = await buildFranchiseOwnerAssigneeList({
    tournamentId,
    commissionerUserId,
    existingTeamOwnerIds,
  });

  if (!assignees.some((person) => person.id === parsed.data)) {
    throw new TournamentServiceError(
      "That login cannot own a franchise here. Add them on Players first, grant a franchise login from their row, then assign the team.",
    );
  }

  return parsed.data;
}

export async function createTeam(userId: string, input: CreateTeamInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId },
    select: { draftPhase: true, createdById: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (
    tournament.draftPhase !== DraftPhase.SETUP &&
    tournament.draftPhase !== DraftPhase.READY
  ) {
    throw new TournamentServiceError(
      "Cannot modify teams after the draft configuration is sealed.",
    );
  }
  const maxOrder = await prisma.team.aggregate({
    where: { tournamentId, deletedAt: null },
    _max: { displayOrder: true },
  });
  let ownerUserId: string | null = null;
  if (input.ownerUserId?.trim()) {
    ownerUserId = await resolveTeamOwnerUserId(
      input.ownerUserId,
      tournament.createdById,
      tournamentId,
    );
  }
  await prisma.team.create({
    data: {
      tournamentId,
      name: input.name,
      shortName: input.shortName || null,
      logoUrl: input.logoUrl || null,
      colorHex: input.colorHex || null,
      ownerUserId,
      displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
    },
  });
  await syncOwnerPlayersForTournament(tournamentId);
}

export async function updateTeam(userId: string, input: UpdateTeamInput): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId },
    select: { draftPhase: true, createdById: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (
    tournament.draftPhase !== DraftPhase.SETUP &&
    tournament.draftPhase !== DraftPhase.READY
  ) {
    throw new TournamentServiceError(
      "Cannot modify teams after the draft configuration is sealed.",
    );
  }
  const existing = await prisma.team.findFirst({
    where: {
      id: input.teamId,
      tournamentId,
      deletedAt: null,
    },
    select: { id: true, ownerUserId: true },
  });
  if (!existing) {
    throw new TournamentServiceError("Team not found.");
  }
  const previousOwnerUserId = existing.ownerUserId;
  const ownerUserId = await resolveTeamOwnerUserId(
    input.ownerUserId,
    tournament.createdById,
    tournamentId,
  );
  await prisma.team.update({
    where: { id: input.teamId },
    data: {
      name: input.name,
      shortName: input.shortName?.trim() ? input.shortName.trim() : null,
      logoUrl: input.logoUrl?.trim() ? input.logoUrl.trim() : null,
      colorHex: input.colorHex?.trim() ? input.colorHex.trim() : null,
      ownerUserId,
    },
  });
  await syncOwnerPlayersForTournament(tournamentId);

  if (
    previousOwnerUserId !== null &&
    previousOwnerUserId !== ownerUserId
  ) {
    await clearFranchiseOwnerLinksWhenNoTeamOwnership(
      tournamentId,
      previousOwnerUserId,
    );
    await removeFranchiseOwnerCredentialsIfOrphaned(previousOwnerUserId);
  }
}

export async function deleteFranchiseOwnerFromTournament(
  commissionerUserId: string,
  tournamentSlug: string,
  ownerUserId: string,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    tournamentSlug,
    commissionerUserId,
  );
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId },
    select: { draftPhase: true, createdById: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }
  if (
    tournament.draftPhase !== DraftPhase.SETUP &&
    tournament.draftPhase !== DraftPhase.READY
  ) {
    throw new TournamentServiceError(
      "Cannot modify franchise owners after the draft configuration is sealed.",
    );
  }
  if (ownerUserId === tournament.createdById) {
    throw new TournamentServiceError("You cannot delete the commissioner login.");
  }

  await prisma.team.updateMany({
    where: {
      tournamentId,
      deletedAt: null,
      ownerUserId,
    },
    data: { ownerUserId: null },
  });

  await prisma.player.updateMany({
    where: {
      tournamentId,
      deletedAt: null,
      linkedOwnerUserId: ownerUserId,
    },
    data: { linkedOwnerUserId: null },
  });

  await syncOwnerPlayersForTournament(tournamentId);
  await removeFranchiseOwnerCredentialsIfOrphaned(ownerUserId);
}

export async function revokeFranchiseLoginFromPlayer(
  commissionerUserId: string,
  tournamentSlug: string,
  playerId: string,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    tournamentSlug,
    commissionerUserId,
  );
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId },
    select: { draftPhase: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }
  if (
    tournament.draftPhase !== DraftPhase.SETUP &&
    tournament.draftPhase !== DraftPhase.READY
  ) {
    throw new TournamentServiceError(
      "Cannot modify franchise owner logins after the draft configuration is sealed.",
    );
  }

  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      tournamentId,
      deletedAt: null,
    },
    select: { linkedOwnerUserId: true },
  });

  if (!player) {
    throw new TournamentServiceError("Player not found.");
  }

  const linkedUserId = player.linkedOwnerUserId;
  if (!linkedUserId) {
    throw new TournamentServiceError(
      "This roster row does not have a franchise login.",
    );
  }

  const ownsTeam = await prisma.team.count({
    where: {
      tournamentId,
      deletedAt: null,
      ownerUserId: linkedUserId,
    },
  });
  if (ownsTeam > 0) {
    throw new TournamentServiceError(
      "Remove them from their franchise on the Teams page first, then revoke the login here.",
    );
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { linkedOwnerUserId: null },
  });

  await syncOwnerPlayersForTournament(tournamentId);
  await removeFranchiseOwnerCredentialsIfOrphaned(linkedUserId);
}

export async function createPlayer(userId: string, input: CreatePlayerInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );
  await assertActiveRosterCategoryForPlayer(tournamentId, input.rosterCategoryId);
  await prisma.player.create({
    data: {
      tournamentId,
      name: input.name,
      photoUrl: input.photoUrl || null,
      rosterCategoryId: input.rosterCategoryId,
      gender: input.gender,
      notes: input.notes || null,
      hasPaidEntryFee: input.hasPaidEntryFee ?? false,
      basePrice: input.basePrice ?? null,
    },
  });
}

export async function updatePlayer(userId: string, input: UpdatePlayerInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );

  const existing = await prisma.player.findFirst({
    where: {
      id: input.playerId,
      tournamentId,
      deletedAt: null,
    },
    select: { rosterCategoryId: true, linkedOwnerUserId: true },
  });

  if (!existing) {
    throw new TournamentServiceError("Player not found.");
  }

  await assertActiveRosterCategoryForPlayer(tournamentId, input.rosterCategoryId);

  const trimmedName = input.name.trim();

  await prisma.player.update({
    where: { id: input.playerId },
    data: {
      name: trimmedName,
      photoUrl: input.photoUrl?.trim() ? input.photoUrl.trim() : null,
      rosterCategoryId: input.rosterCategoryId,
      gender: input.gender,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      hasPaidEntryFee: input.hasPaidEntryFee ?? false,
      basePrice: input.basePrice === undefined ? undefined : input.basePrice,
    },
  });

  if (existing.linkedOwnerUserId) {
    await prisma.userProfile.updateMany({
      where: {
        id: existing.linkedOwnerUserId,
        deletedAt: null,
      },
      data: { displayName: trimmedName },
    });
  }

  if (existing.rosterCategoryId !== input.rosterCategoryId) {
    await reconcileSquadRulesForTournament(tournamentId);
  }
}

export async function bulkUpdatePlayers(
  userId: string,
  input: BulkUpdatePlayersInput,
) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );

  if (input.rosterCategoryId) {
    await assertActiveRosterCategoryForPlayer(tournamentId, input.rosterCategoryId);
  }

  const existingPlayers = await prisma.player.findMany({
    where: {
      tournamentId,
      deletedAt: null,
      id: { in: input.playerIds },
    },
    select: { id: true },
  });

  if (existingPlayers.length !== input.playerIds.length) {
    throw new TournamentServiceError("One or more selected players no longer exist.");
  }

  const updateData: {
    rosterCategoryId?: string;
    hasPaidEntryFee?: boolean;
  } = {};

  if (input.rosterCategoryId) {
    updateData.rosterCategoryId = input.rosterCategoryId;
  }
  if (input.hasPaidEntryFee !== undefined) {
    updateData.hasPaidEntryFee = input.hasPaidEntryFee;
  }

  await prisma.player.updateMany({
    where: {
      tournamentId,
      deletedAt: null,
      id: { in: input.playerIds },
    },
    data: updateData,
  });

  if (input.rosterCategoryId) {
    await reconcileSquadRulesForTournament(tournamentId);
  }
}

export async function softDeleteTournament(
  userId: string,
  tournamentSlug: string,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(tournamentSlug, userId);
  const pickCount = await prisma.pick.count({
    where: { tournamentId },
  });
  if (pickCount > 0) {
    throw new TournamentServiceError(
      "This tournament has draft picks on record. Remove picks via Admin undo flows before deleting, or archive manually.",
    );
  }
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { deletedAt: new Date() },
  });
}

export async function softDeletePlayer(
  userId: string,
  input: DeletePlayerInput,
): Promise<void> {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );

  const existing = await prisma.player.findFirst({
    where: {
      id: input.playerId,
      tournamentId,
      deletedAt: null,
    },
    select: { linkedOwnerUserId: true },
  });

  if (!existing) {
    throw new TournamentServiceError("Player not found.");
  }

  if (existing.linkedOwnerUserId !== null) {
    throw new TournamentServiceError(
      "Revoke the franchise login on the Players page first, or remove them as franchise owner on Teams, then delete this roster row.",
    );
  }

  const pickCount = await prisma.pick.count({
    where: { playerId: input.playerId },
  });
  if (pickCount > 0) {
    throw new TournamentServiceError(
      "This player appears on draft picks. Undo those picks in Admin before deleting.",
    );
  }

  await prisma.player.update({
    where: { id: input.playerId },
    data: { deletedAt: new Date() },
  });

  await reconcileSquadRulesForTournament(tournamentId);
}

export async function reconcileSquadRulesForTournament(
  tournamentId: string,
): Promise<void> {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { picksPerTeam: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }

  const teamCount = await prisma.team.count({
    where: { tournamentId, deletedAt: null },
  });

  if (teamCount === 0) {
    // With no teams we cannot compute balanced per-team caps yet. Reset to the
    // permissive default (picksPerTeam) rather than 0 — a 0 cap would silently
    // block every bid/pick once teams and players are added later.
    await prisma.squadRule.updateMany({
      where: { tournamentId },
      data: { maxCount: tournament.picksPerTeam },
    });
    return;
  }

  const totalPlayers = await prisma.player.count({
    where: { tournamentId, deletedAt: null },
  });

  const categoryRows = await prisma.rosterCategory.findMany({
    where: { tournamentId, archivedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, displayOrder: true, name: true },
  });
  const categoryOrder = rosterCategoryOrderIds(categoryRows);
  const doublesCategoryIds = new Set(
    categoryRows
      .filter((row) => isDoublesCategoryName(row.name))
      .map((row) => row.id),
  );

  const grouped = await prisma.player.groupBy({
    by: ["rosterCategoryId"],
    where: { tournamentId, deletedAt: null },
    _count: { _all: true },
  });

  const playersPerCategory: Partial<Record<string, number>> = {};
  for (const row of grouped) {
    playersPerCategory[row.rosterCategoryId] = row._count._all;
  }

  const caps = computePerTeamCategoryCaps({
    teamCount,
    categoryOrder,
    playersPerCategory,
    doublesCategoryIds,
  });

  const categoryLabels = Object.fromEntries(
    categoryRows.map((c) => [c.id, c.name]),
  );

  const draftRules = categoryOrder.map((rosterCategoryId) => ({
    rosterCategoryId,
    maxCount: caps[rosterCategoryId],
  }));

  const feasibility = validateSquadRulesAgainstRoster({
    teamCount,
    picksPerTeam: tournament.picksPerTeam,
    totalPlayers,
    playersPerCategory,
    categoryLabels,
    rules: draftRules,
    requireDraftSlotsVsRoster: false,
  });

  if (!feasibility.ok) {
    throw new TournamentServiceError(
      formatSquadValidationErrors(feasibility.errors),
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const rosterCategoryId of categoryOrder) {
      await tx.squadRule.updateMany({
        where: { tournamentId, rosterCategoryId },
        data: { maxCount: caps[rosterCategoryId] },
      });
    }
  });
}

export async function saveSquadRules(userId: string, input: SquadRulesInput) {
  const tournamentId = await assertTournamentOwnership(
    input.tournamentSlug,
    userId,
  );

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { picksPerTeam: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }

  const teamCount = await prisma.team.count({
    where: { tournamentId, deletedAt: null },
  });

  const totalPlayers = await prisma.player.count({
    where: { tournamentId, deletedAt: null },
  });

  const categoryRows = await prisma.rosterCategory.findMany({
    where: { tournamentId, archivedAt: null },
    select: { id: true, name: true },
  });
  const allowedIds = new Set(categoryRows.map((c) => c.id));
  for (const rule of input.rules) {
    if (!allowedIds.has(rule.rosterCategoryId)) {
      throw new TournamentServiceError("Pick limits must reference roster groups from this tournament.");
    }
  }
  const categoryLabels = Object.fromEntries(categoryRows.map((c) => [c.id, c.name]));

  const grouped = await prisma.player.groupBy({
    by: ["rosterCategoryId"],
    where: { tournamentId, deletedAt: null },
    _count: { _all: true },
  });

  const playersPerCategory: Partial<Record<string, number>> = {};
  for (const row of grouped) {
    playersPerCategory[row.rosterCategoryId] = row._count._all;
  }

  const feasibility = validateSquadRulesAgainstRoster({
    teamCount,
    picksPerTeam: tournament.picksPerTeam,
    totalPlayers,
    playersPerCategory,
    categoryLabels,
    rules: input.rules,
  });

  if (!feasibility.ok) {
    throw new TournamentServiceError(
      formatSquadValidationErrors(feasibility.errors),
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const rule of input.rules) {
      await tx.squadRule.updateMany({
        where: {
          tournamentId,
          rosterCategoryId: rule.rosterCategoryId,
        },
        data: { maxCount: rule.maxCount },
      });
    }
  });
}
