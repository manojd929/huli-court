import { AllocationMethod, DraftLogAction, DraftPhase, PickStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRandomAssignmentPlan } from "@/lib/draft/random-assignment";
import { DraftServiceError } from "@/services/draft-service";
import { syncOwnerPlayersForTournament } from "@/services/tournament-service";

export interface RandomAssignmentResult {
  assignedCount: number;
  unassignedCount: number;
}

/**
 * One-shot RANDOM_ASSIGNMENT run: assigns every eligible undrafted player to a
 * team (balanced, respecting squad caps and picksPerTeam) and completes the
 * draft. Owner-stub roster rows keep their pre-assigned teams and count toward
 * occupancy, mirroring the snake-draft rules.
 */
export async function runRandomAssignment(params: {
  tournamentSlug: string;
  actorUserId: string;
}): Promise<RandomAssignmentResult> {
  const preview = await prisma.tournament.findFirst({
    where: { slug: params.tournamentSlug, deletedAt: null },
    select: { id: true },
  });
  if (!preview) throw new DraftServiceError("Tournament not found.");
  await syncOwnerPlayersForTournament(preview.id);

  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findFirst({
      where: { slug: params.tournamentSlug, deletedAt: null },
      include: {
        teams: { where: { deletedAt: null } },
        players: { where: { deletedAt: null } },
        squadRules: { where: { rosterCategory: { archivedAt: null } } },
        picks: { where: { status: PickStatus.CONFIRMED } },
      },
    });
    if (!tournament) throw new DraftServiceError("Tournament not found.");
    if (tournament.createdById !== params.actorUserId) {
      throw new DraftServiceError("Only the tournament admin can run random assignment.");
    }
    if (tournament.allocationMethod !== AllocationMethod.RANDOM_ASSIGNMENT) {
      throw new DraftServiceError("This tournament is not configured for random assignment.");
    }
    if (tournament.draftPhase !== DraftPhase.SETUP && tournament.draftPhase !== DraftPhase.READY) {
      throw new DraftServiceError("Random assignment can only run before the draft has started.");
    }
    if (tournament.teams.length === 0) {
      throw new DraftServiceError("Add teams before running random assignment.");
    }

    const ownerTeamIdsByUserId = new Map<string, string>();
    for (const team of tournament.teams) {
      if (team.ownerUserId) ownerTeamIdsByUserId.set(team.ownerUserId, team.id);
    }
    const pickedPlayerIds = new Set(tournament.picks.map((p) => p.playerId));
    const pickTeamByPlayer = new Map(tournament.picks.map((p) => [p.playerId, p.teamId]));

    // Existing occupancy: confirmed picks + owner-stub rows tied to a team.
    const existingTotal = new Map<string, number>();
    const existingByCategory = new Map<string, Record<string, number>>();
    const bump = (teamId: string, categoryId: string) => {
      existingTotal.set(teamId, (existingTotal.get(teamId) ?? 0) + 1);
      const cats = existingByCategory.get(teamId) ?? {};
      cats[categoryId] = (cats[categoryId] ?? 0) + 1;
      existingByCategory.set(teamId, cats);
    };
    for (const player of tournament.players) {
      const pickTeam = pickTeamByPlayer.get(player.id);
      if (pickTeam) {
        bump(pickTeam, player.rosterCategoryId);
        continue;
      }
      if (player.linkedOwnerUserId) {
        const stubTeam = ownerTeamIdsByUserId.get(player.linkedOwnerUserId);
        if (stubTeam) bump(stubTeam, player.rosterCategoryId);
      }
    }

    const eligible = tournament.players.filter(
      (player) =>
        !pickedPlayerIds.has(player.id) &&
        !player.isUnavailable &&
        !player.isLocked &&
        player.linkedOwnerUserId === null,
    );

    const plan = buildRandomAssignmentPlan({
      players: eligible.map((p) => ({
        id: p.id,
        rosterCategoryId: p.rosterCategoryId,
      })),
      teams: tournament.teams.map((team) => ({
        id: team.id,
        existingTotal: existingTotal.get(team.id) ?? 0,
        existingByCategory: existingByCategory.get(team.id) ?? {},
      })),
      categoryCaps: Object.fromEntries(
        tournament.squadRules.map((rule) => [rule.rosterCategoryId, rule.maxCount]),
      ),
      picksPerTeam: tournament.picksPerTeam,
    });

    let slotIndex = tournament.picks.length;
    if (plan.assignments.length > 0) {
      await tx.pick.createMany({
        data: plan.assignments.map((assignment) => ({
          tournamentId: tournament.id,
          playerId: assignment.playerId,
          teamId: assignment.teamId,
          slotIndex: slotIndex++,
          status: PickStatus.CONFIRMED,
          confirmedByUserId: params.actorUserId,
        })),
      });
    }

    const now = new Date();
    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        draftPhase: DraftPhase.COMPLETED,
        draftStartedAt: tournament.draftStartedAt ?? now,
        draftEndedAt: now,
        pendingPickPlayerId: null,
        pendingPickTeamId: null,
        pendingIdempotencyKey: null,
      },
    });

    await tx.draftLog.create({
      data: {
        tournamentId: tournament.id,
        action: DraftLogAction.RANDOM_ASSIGNMENT_RUN,
        message: `Random assignment placed ${plan.assignments.length} players across ${tournament.teams.length} teams${
          plan.unassignedPlayerIds.length > 0
            ? `; ${plan.unassignedPlayerIds.length} could not fit under the squad rules`
            : ""
        }.`,
        payload: {
          assignedCount: plan.assignments.length,
          unassignedPlayerIds: plan.unassignedPlayerIds,
        } as Prisma.InputJsonValue,
        actorUserId: params.actorUserId,
      },
    });

    return {
      assignedCount: plan.assignments.length,
      unassignedCount: plan.unassignedPlayerIds.length,
    };
  });
}
