import { FixtureStatus, TournamentFormat } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getFixturesSummary } from "@/services/fixtures-service";
import { assertTournamentOwnership, TournamentServiceError } from "@/services/tournament-service";

export interface StandingRow {
  entityId: string;
  name: string;
  eliminated: boolean;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  pointsScored: number;
  pointsConceded: number;
  pointDifference: number;
}

type TournamentRunMatch = Prisma.FixtureMatchGetPayload<{
  include: {
    participants: {
      include: {
        player: { select: { id: true; name: true; isEliminated: true } };
        team: { select: { id: true; name: true; isEliminated: true } };
      };
    };
  };
}>;

export interface TournamentRunSummary {
  tournament: {
    id: string;
    createdById: string;
    format: TournamentFormat;
    draftPhase: string;
    name: string;
  };
  ties: Prisma.FixtureTieGetPayload<{
    include: {
      teamOne: { select: { id: true; name: true; isEliminated: true } };
      teamTwo: { select: { id: true; name: true; isEliminated: true } };
    };
  }>[];
  matches: TournamentRunMatch[];
  standings: StandingRow[];
}

function winnerFromScore(sideOneScore: number, sideTwoScore: number): "SIDE_ONE" | "SIDE_TWO" {
  if (sideOneScore === sideTwoScore) {
    throw new TournamentServiceError("Completed match cannot have tied score.");
  }
  return sideOneScore > sideTwoScore ? "SIDE_ONE" : "SIDE_TWO";
}

export async function updateFixtureMatchState(params: {
  actorUserId: string;
  tournamentSlug: string;
  matchId: string;
  status?: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  sideOneScore?: number | null;
  sideTwoScore?: number | null;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const match = await prisma.fixtureMatch.findFirst({
    where: { id: params.matchId, tournamentId },
    select: { id: true },
  });
  if (!match) throw new TournamentServiceError("Match not found.");

  let winnerSide: "SIDE_ONE" | "SIDE_TWO" | null = null;
  let sideOneScore: number | null = params.sideOneScore ?? null;
  let sideTwoScore: number | null = params.sideTwoScore ?? null;

  const nextStatus =
    params.status ??
    (sideOneScore !== null || sideTwoScore !== null
      ? FixtureStatus.COMPLETED
      : FixtureStatus.SCHEDULED);

  if (nextStatus === FixtureStatus.COMPLETED) {
    if (sideOneScore === null || sideTwoScore === null) {
      throw new TournamentServiceError("Completed match requires both scores.");
    }
    winnerSide = winnerFromScore(sideOneScore, sideTwoScore);
  }

  if (nextStatus === FixtureStatus.SCHEDULED || nextStatus === FixtureStatus.CANCELLED) {
    sideOneScore = null;
    sideTwoScore = null;
    winnerSide = null;
  }

  await prisma.fixtureMatch.update({
    where: { id: params.matchId },
    data: { status: nextStatus, sideOneScore, sideTwoScore, winnerSide },
  });
}

export async function toggleTeamElimination(params: {
  actorUserId: string;
  tournamentSlug: string;
  teamId: string;
  eliminated: boolean;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  await prisma.team.updateMany({
    where: { id: params.teamId, tournamentId, deletedAt: null },
    data: { isEliminated: params.eliminated },
  });
}

export async function togglePlayerElimination(params: {
  actorUserId: string;
  tournamentSlug: string;
  playerId: string;
  eliminated: boolean;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  await prisma.player.updateMany({
    where: { id: params.playerId, tournamentId, deletedAt: null },
    data: { isEliminated: params.eliminated },
  });
}

export async function getTournamentRunSummary(
  tournamentSlug: string,
): Promise<TournamentRunSummary | null> {
  await getFixturesSummary(tournamentSlug);

  const tournament = await prisma.tournament.findFirst({
    where: { slug: tournamentSlug, deletedAt: null },
    select: { id: true, createdById: true, format: true, draftPhase: true, name: true },
  });
  if (!tournament) return null;

  const [ties, matches, teams, players] = await Promise.all([
    prisma.fixtureTie.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ roundNumber: "asc" }, { sequence: "asc" }],
      include: {
        teamOne: { select: { id: true, name: true, isEliminated: true } },
        teamTwo: { select: { id: true, name: true, isEliminated: true } },
      },
    }),
    prisma.fixtureMatch.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ tieId: "asc" }, { sequence: "asc" }, { createdAt: "asc" }],
      include: {
        participants: {
          include: {
            player: { select: { id: true, name: true, isEliminated: true } },
            team: { select: { id: true, name: true, isEliminated: true } },
          },
        },
      },
    }),
    prisma.team.findMany({
      where: { tournamentId: tournament.id, deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, isEliminated: true },
    }),
    prisma.player.findMany({
      where: { tournamentId: tournament.id, deletedAt: null },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, isEliminated: true },
    }),
  ]);

  const standings = deriveStandings({ format: tournament.format, teams, players, matches });
  return { tournament, ties, matches, standings };
}

function deriveStandings(params: {
  format: TournamentFormat;
  teams: Array<{ id: string; name: string; isEliminated: boolean }>;
  players: Array<{ id: string; name: string; isEliminated: boolean }>;
  matches: TournamentRunMatch[];
}): StandingRow[] {
  const byId = new Map<string, StandingRow>();

  if (params.format === TournamentFormat.DOUBLES_ONLY) {
    for (const team of params.teams) {
      byId.set(team.id, {
        entityId: team.id,
        name: team.name,
        eliminated: team.isEliminated,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        points: 0,
        pointsScored: 0,
        pointsConceded: 0,
        pointDifference: 0,
      });
    }
  } else {
    for (const player of params.players) {
      byId.set(player.id, {
        entityId: player.id,
        name: player.name,
        eliminated: player.isEliminated,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        points: 0,
        pointsScored: 0,
        pointsConceded: 0,
        pointDifference: 0,
      });
    }
  }

  for (const match of params.matches) {
    if (match.status !== FixtureStatus.COMPLETED) continue;
    if (match.sideOneScore === null || match.sideTwoScore === null || match.winnerSide === null)
      continue;

    if (params.format === TournamentFormat.DOUBLES_ONLY) {
      const sideOneTeam = match.participants.find((p) => p.side === "SIDE_ONE" && p.team)?.team;
      const sideTwoTeam = match.participants.find((p) => p.side === "SIDE_TWO" && p.team)?.team;
      if (!sideOneTeam || !sideTwoTeam) continue;

      const row1 = byId.get(sideOneTeam.id);
      const row2 = byId.get(sideTwoTeam.id);
      if (!row1 || !row2) continue;

      row1.matchesPlayed += 1;
      row2.matchesPlayed += 1;
      row1.pointsScored += match.sideOneScore;
      row1.pointsConceded += match.sideTwoScore;
      row2.pointsScored += match.sideTwoScore;
      row2.pointsConceded += match.sideOneScore;

      if (match.winnerSide === "SIDE_ONE") {
        row1.wins += 1;
        row1.points += 1;
        row2.losses += 1;
      } else {
        row2.wins += 1;
        row2.points += 1;
        row1.losses += 1;
      }
    } else {
      const sideOnePlayer = match.participants.find((p) => p.side === "SIDE_ONE")?.player;
      const sideTwoPlayer = match.participants.find((p) => p.side === "SIDE_TWO")?.player;
      if (!sideOnePlayer || !sideTwoPlayer) continue;

      const row1 = byId.get(sideOnePlayer.id);
      const row2 = byId.get(sideTwoPlayer.id);
      if (!row1 || !row2) continue;

      row1.matchesPlayed += 1;
      row2.matchesPlayed += 1;
      row1.pointsScored += match.sideOneScore;
      row1.pointsConceded += match.sideTwoScore;
      row2.pointsScored += match.sideTwoScore;
      row2.pointsConceded += match.sideOneScore;

      if (match.winnerSide === "SIDE_ONE") {
        row1.wins += 1;
        row1.points += 1;
        row2.losses += 1;
      } else {
        row2.wins += 1;
        row2.points += 1;
        row1.losses += 1;
      }
    }
  }

  const rows = [...byId.values()];
  for (const row of rows) {
    row.pointDifference = row.pointsScored - row.pointsConceded;
  }

  return rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
    if (b.pointsScored !== a.pointsScored) return b.pointsScored - a.pointsScored;
    return a.name.localeCompare(b.name);
  });
}
