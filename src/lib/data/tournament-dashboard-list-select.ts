import type { Prisma } from "@/generated/prisma/client";

/** Soft-deleted teams/players excluded (matches roster and rules aggregation). */
const activeTeamRelationCountWhere: Prisma.TeamWhereInput = {
  deletedAt: null,
};

const activePlayerRelationCountWhere: Prisma.PlayerWhereInput = {
  deletedAt: null,
};

/**
 * Shape used by dashboard tournament cards and `listTournamentsForUser`.
 * Counts reflect active franchises and active roster rows only.
 */
export const tournamentDashboardListSelect = {
  id: true,
  name: true,
  slug: true,
  sport: true,
  format: true,
  draftPhase: true,
  updatedAt: true,
  _count: {
    select: {
      teams: { where: activeTeamRelationCountWhere },
      players: { where: activePlayerRelationCountWhere },
    },
  },
} satisfies Prisma.TournamentSelect;

export type TournamentDashboardListRow = Prisma.TournamentGetPayload<{
  select: typeof tournamentDashboardListSelect;
}>;
