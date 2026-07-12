import {
  FixtureMatchType,
  FixtureSide,
  FixtureStatus,
  PickStatus,
  TournamentFormat,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertTournamentOwnership, TournamentServiceError } from "@/services/tournament-service";

interface FixturePlayerOption {
  id: string;
  name: string;
}

function fixturesDelegatesAvailable(): boolean {
  const prismaWithDelegates = prisma as unknown as {
    fixtureTie?: { findMany: (...args: unknown[]) => Promise<unknown> };
    fixtureMatch?: { findMany: (...args: unknown[]) => Promise<unknown> };
  };
  return (
    typeof prismaWithDelegates.fixtureTie?.findMany === "function" &&
    typeof prismaWithDelegates.fixtureMatch?.findMany === "function"
  );
}

async function getEligibleDoublesPlayersByTeam(params: {
  tournamentId: string;
  teamIds: string[];
}): Promise<Map<string, FixturePlayerOption[]>> {
  const teams = await prisma.team.findMany({
    where: {
      tournamentId: params.tournamentId,
      id: { in: params.teamIds },
      deletedAt: null,
    },
    select: { id: true, ownerUserId: true },
  });
  const ownerUserIds = teams
    .map((team) => team.ownerUserId)
    .filter((ownerUserId): ownerUserId is string => Boolean(ownerUserId));

  const picks = await prisma.pick.findMany({
    where: {
      tournamentId: params.tournamentId,
      teamId: { in: params.teamIds },
      status: PickStatus.CONFIRMED,
      player: {
        deletedAt: null,
      },
    },
    orderBy: [{ slotIndex: "asc" }, { createdAt: "asc" }],
    select: {
      teamId: true,
      player: { select: { id: true, name: true } },
    },
  });
  const ownerRows =
    ownerUserIds.length > 0
      ? await prisma.player.findMany({
          where: {
            tournamentId: params.tournamentId,
            deletedAt: null,
            linkedOwnerUserId: { in: ownerUserIds },
          },
          select: {
            id: true,
            name: true,
            linkedOwnerUserId: true,
          },
        })
      : [];

  const playersByTeam = new Map<string, FixturePlayerOption[]>();
  for (const pick of picks) {
    const existing = playersByTeam.get(pick.teamId) ?? [];
    if (!existing.some((player) => player.id === pick.player.id)) {
      existing.push(pick.player);
    }
    playersByTeam.set(pick.teamId, existing);
  }

  const teamIdByOwnerUserId = new Map<string, string>();
  for (const team of teams) {
    if (team.ownerUserId) {
      teamIdByOwnerUserId.set(team.ownerUserId, team.id);
    }
  }

  for (const ownerRow of ownerRows) {
    if (!ownerRow.linkedOwnerUserId) {
      continue;
    }
    const teamId = teamIdByOwnerUserId.get(ownerRow.linkedOwnerUserId);
    if (!teamId) {
      continue;
    }
    const existing = playersByTeam.get(teamId) ?? [];
    if (!existing.some((player) => player.id === ownerRow.id)) {
      existing.push({ id: ownerRow.id, name: ownerRow.name });
    }
    playersByTeam.set(teamId, existing);
  }

  return playersByTeam;
}

function matchHasLockedResult(match: {
  status: FixtureStatus;
  sideOneScore: number | null;
  sideTwoScore: number | null;
  winnerSide: FixtureSide | null;
}): boolean {
  return (
    match.status === FixtureStatus.COMPLETED ||
    match.sideOneScore !== null ||
    match.sideTwoScore !== null ||
    match.winnerSide !== null
  );
}

async function syncDoublesFixtureParticipantsForTournament(tournamentId: string): Promise<void> {
  if (!fixturesDelegatesAvailable()) {
    return;
  }

  const ties = await prisma.fixtureTie.findMany({
    where: { tournamentId },
    orderBy: [{ roundNumber: "asc" }, { sequence: "asc" }],
    include: {
      teamOne: { select: { id: true, name: true } },
      teamTwo: { select: { id: true, name: true } },
      matches: {
        where: { matchType: FixtureMatchType.DOUBLES },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        include: {
          participants: {
            select: { id: true, side: true, teamId: true, playerId: true },
          },
        },
      },
    },
  });

  if (ties.length === 0) {
    return;
  }

  const teamIds = [...new Set(ties.flatMap((tie) => [tie.teamOne.id, tie.teamTwo.id]))];
  const playersByTeam = await getEligibleDoublesPlayersByTeam({
    tournamentId,
    teamIds,
  });

  await prisma.$transaction(async (tx) => {
    for (const tie of ties) {
      const teamOnePlayers = playersByTeam.get(tie.teamOne.id) ?? [];
      const teamTwoPlayers = playersByTeam.get(tie.teamTwo.id) ?? [];

      for (const [matchIndex, match] of tie.matches.entries()) {
        if (match.participants.length > 0) {
          continue;
        }

        if (teamOnePlayers.length < 2 || teamTwoPlayers.length < 2) {
          continue;
        }

        const sideOne = [
          teamOnePlayers[(matchIndex * 2) % teamOnePlayers.length]!,
          teamOnePlayers[(matchIndex * 2 + 1) % teamOnePlayers.length]!,
        ];
        const sideTwo = [
          teamTwoPlayers[(matchIndex * 2) % teamTwoPlayers.length]!,
          teamTwoPlayers[(matchIndex * 2 + 1) % teamTwoPlayers.length]!,
        ];

        await tx.fixtureMatchParticipant.createMany({
          data: [
            {
              matchId: match.id,
              playerId: sideOne[0].id,
              side: FixtureSide.SIDE_ONE,
              teamId: tie.teamOne.id,
            },
            {
              matchId: match.id,
              playerId: sideOne[1].id,
              side: FixtureSide.SIDE_ONE,
              teamId: tie.teamOne.id,
            },
            {
              matchId: match.id,
              playerId: sideTwo[0].id,
              side: FixtureSide.SIDE_TWO,
              teamId: tie.teamTwo.id,
            },
            {
              matchId: match.id,
              playerId: sideTwo[1].id,
              side: FixtureSide.SIDE_TWO,
              teamId: tie.teamTwo.id,
            },
          ],
        });
      }
    }
  });
}

export async function getFixturesSummary(tournamentSlug: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: tournamentSlug, deletedAt: null },
    select: { id: true, draftPhase: true, createdById: true, format: true },
  });
  if (!tournament) return null;
  if (!fixturesDelegatesAvailable()) {
    return { tournament, ties: [], matches: [], fixturesReady: false };
  }

  await syncDoublesFixtureParticipantsForTournament(tournament.id);

  const [ties, matches] = await Promise.all([
    prisma.fixtureTie.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ roundNumber: "asc" }, { sequence: "asc" }],
      include: {
        teamOne: { select: { id: true, name: true } },
        teamTwo: { select: { id: true, name: true } },
        matches: { select: { id: true, status: true } },
      },
    }),
    prisma.fixtureMatch.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
      include: {
        participants: {
          include: {
            player: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return { tournament, ties, matches, fixturesReady: true };
}

export async function getFixturesAdminOptions(tournamentSlug: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: tournamentSlug, deletedAt: null },
    select: { id: true, format: true },
  });
  if (!tournament) {
    return null;
  }

  const [teams, players] = await Promise.all([
    prisma.team.findMany({
      where: { tournamentId: tournament.id, deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.player.findMany({
      where: { tournamentId: tournament.id, deletedAt: null },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const doublesPlayersByTeam = await getEligibleDoublesPlayersByTeam({
    tournamentId: tournament.id,
    teamIds: teams.map((team) => team.id),
  });

  return {
    format: tournament.format,
    teams,
    players,
    doublesPlayersByTeam: teams.map((team) => ({
      teamId: team.id,
      players: doublesPlayersByTeam.get(team.id) ?? [],
    })),
  };
}

export async function generateRoundRobinTies(params: {
  actorUserId: string;
  tournamentSlug: string;
  matchesPerTie: number;
  categoryLabel?: string;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { id: true, draftPhase: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (tournament.draftPhase !== "COMPLETED") {
    throw new TournamentServiceError("Complete the draft before generating doubles fixtures.");
  }

  const teams = await prisma.team.findMany({
    where: { tournamentId, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (teams.length < 2) {
    throw new TournamentServiceError("At least two teams are required.");
  }
  if (!fixturesDelegatesAvailable()) {
    throw new TournamentServiceError(
      "Fixtures schema is not ready yet. Run database migration first.",
    );
  }

  const completedMatchesCount = await prisma.fixtureMatch.count({
    where: {
      tournamentId,
      OR: [
        { status: FixtureStatus.COMPLETED },
        { winnerSide: { not: null } },
        { sideOneScore: { not: null } },
        { sideTwoScore: { not: null } },
      ],
    },
  });
  if (completedMatchesCount > 0) {
    throw new TournamentServiceError(
      "Cannot regenerate fixtures after results have been recorded. Delete or reset scored matches first.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.fixtureMatch.deleteMany({ where: { tournamentId } });
    await tx.fixtureTie.deleteMany({ where: { tournamentId } });

    let sequence = 0;
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        const tie = await tx.fixtureTie.create({
          data: {
            tournamentId,
            teamOneId: teams[i].id,
            teamTwoId: teams[j].id,
            roundNumber: i + 1,
            sequence,
            categoryLabel: params.categoryLabel,
          },
        });
        for (let k = 0; k < params.matchesPerTie; k += 1) {
          await tx.fixtureMatch.create({
            data: {
              tournamentId,
              tieId: tie.id,
              matchType: FixtureMatchType.DOUBLES,
              sequence: k,
              status: FixtureStatus.SCHEDULED,
              categoryLabel: params.categoryLabel,
            },
          });
        }
        sequence += 1;
      }
    }
  });

  await syncDoublesFixtureParticipantsForTournament(tournamentId);
}

export async function createFixtureTie(params: {
  actorUserId: string;
  tournamentSlug: string;
  teamOneId: string;
  teamTwoId: string;
  roundNumber?: number;
  matchesPerTie: number;
  categoryLabel?: string;
}) {
  if (params.teamOneId === params.teamTwoId) {
    throw new TournamentServiceError("Choose two different teams.");
  }

  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const [tournament, teams, lastTie] = await Promise.all([
    prisma.tournament.findFirst({
      where: { id: tournamentId, deletedAt: null },
      select: { id: true, draftPhase: true },
    }),
    prisma.team.findMany({
      where: {
        tournamentId,
        id: { in: [params.teamOneId, params.teamTwoId] },
        deletedAt: null,
      },
      select: { id: true },
    }),
    prisma.fixtureTie.findFirst({
      where: { tournamentId },
      orderBy: [{ sequence: "desc" }],
      select: { sequence: true },
    }),
  ]);
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }
  if (tournament.draftPhase !== "COMPLETED") {
    throw new TournamentServiceError("Complete the draft before building fixtures.");
  }
  if (teams.length !== 2) {
    throw new TournamentServiceError("Both teams must belong to this tournament.");
  }

  const tieSequence = (lastTie?.sequence ?? -1) + 1;
  await prisma.$transaction(async (tx) => {
    const tie = await tx.fixtureTie.create({
      data: {
        tournamentId,
        teamOneId: params.teamOneId,
        teamTwoId: params.teamTwoId,
        roundNumber: params.roundNumber ?? null,
        sequence: tieSequence,
        categoryLabel: params.categoryLabel,
      },
    });

    for (let matchIndex = 0; matchIndex < params.matchesPerTie; matchIndex += 1) {
      await tx.fixtureMatch.create({
        data: {
          tournamentId,
          tieId: tie.id,
          matchType: FixtureMatchType.DOUBLES,
          sequence: matchIndex,
          status: FixtureStatus.SCHEDULED,
          categoryLabel: params.categoryLabel,
        },
      });
    }
  });

  await syncDoublesFixtureParticipantsForTournament(tournamentId);
}

export async function createTieMatch(params: {
  actorUserId: string;
  tournamentSlug: string;
  tieId: string;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const tie = await prisma.fixtureTie.findFirst({
    where: { id: params.tieId, tournamentId },
    include: {
      matches: {
        orderBy: [{ sequence: "desc" }],
        select: {
          sequence: true,
          status: true,
          sideOneScore: true,
          sideTwoScore: true,
          winnerSide: true,
        },
      },
    },
  });
  if (!tie) {
    throw new TournamentServiceError("Tie not found.");
  }
  if (tie.matches.some((match) => matchHasLockedResult(match))) {
    throw new TournamentServiceError(
      "Cannot add matches to a tie after results have been recorded.",
    );
  }

  await prisma.fixtureMatch.create({
    data: {
      tournamentId,
      tieId: tie.id,
      matchType: FixtureMatchType.DOUBLES,
      status: FixtureStatus.SCHEDULED,
      categoryLabel: tie.categoryLabel,
      sequence: (tie.matches[0]?.sequence ?? -1) + 1,
    },
  });

  await syncDoublesFixtureParticipantsForTournament(tournamentId);
}

export async function assignTieMatchParticipants(params: {
  actorUserId: string;
  tournamentSlug: string;
  matchId: string;
  sideOnePlayerIds: string[];
  sideTwoPlayerIds: string[];
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const match = await prisma.fixtureMatch.findFirst({
    where: { id: params.matchId, tournamentId },
    include: {
      tie: {
        select: {
          teamOneId: true,
          teamTwoId: true,
        },
      },
    },
  });
  if (!match) {
    throw new TournamentServiceError("Match not found.");
  }
  if (match.matchType !== FixtureMatchType.DOUBLES) {
    throw new TournamentServiceError(
      "Manual participant assignment is only supported for doubles ties.",
    );
  }
  if (!match.tie) {
    throw new TournamentServiceError("Only tie matches can be assigned from this screen.");
  }
  if (match.status === FixtureStatus.COMPLETED) {
    throw new TournamentServiceError("Completed matches cannot be edited.");
  }

  const sideOneIds = [...new Set(params.sideOnePlayerIds)];
  const sideTwoIds = [...new Set(params.sideTwoPlayerIds)];
  if (sideOneIds.length > 2 || sideTwoIds.length > 2) {
    throw new TournamentServiceError("Each doubles side can have at most two players.");
  }
  const allIds = [...sideOneIds, ...sideTwoIds];
  if (allIds.length !== new Set(allIds).size) {
    throw new TournamentServiceError("A player cannot appear on both sides of the same match.");
  }

  const eligiblePlayersByTeam = await getEligibleDoublesPlayersByTeam({
    tournamentId,
    teamIds: [match.tie.teamOneId, match.tie.teamTwoId],
  });
  const sideOneAllowedIds = new Set(
    (eligiblePlayersByTeam.get(match.tie.teamOneId) ?? []).map((player) => player.id),
  );
  const sideTwoAllowedIds = new Set(
    (eligiblePlayersByTeam.get(match.tie.teamTwoId) ?? []).map((player) => player.id),
  );

  if (!sideOneIds.every((playerId) => sideOneAllowedIds.has(playerId))) {
    throw new TournamentServiceError(
      "Side one contains a player who does not belong to that team.",
    );
  }
  if (!sideTwoIds.every((playerId) => sideTwoAllowedIds.has(playerId))) {
    throw new TournamentServiceError(
      "Side two contains a player who does not belong to that team.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.fixtureMatchParticipant.deleteMany({
      where: { matchId: match.id },
    });

    const createData = [
      ...sideOneIds.map((playerId) => ({
        matchId: match.id,
        playerId,
        side: FixtureSide.SIDE_ONE,
        teamId: match.tie?.teamOneId,
      })),
      ...sideTwoIds.map((playerId) => ({
        matchId: match.id,
        playerId,
        side: FixtureSide.SIDE_TWO,
        teamId: match.tie?.teamTwoId,
      })),
    ];

    if (createData.length > 0) {
      await tx.fixtureMatchParticipant.createMany({
        data: createData,
      });
    }
  });
}

export async function deleteFixtureTie(params: {
  actorUserId: string;
  tournamentSlug: string;
  tieId: string;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const tie = await prisma.fixtureTie.findFirst({
    where: { id: params.tieId, tournamentId },
    include: {
      matches: {
        select: {
          id: true,
          status: true,
          sideOneScore: true,
          sideTwoScore: true,
          winnerSide: true,
        },
      },
    },
  });
  if (!tie) {
    throw new TournamentServiceError("Tie not found.");
  }
  if (tie.matches.some((match) => matchHasLockedResult(match))) {
    throw new TournamentServiceError("Cannot delete a tie after results have been recorded.");
  }
  await prisma.fixtureTie.delete({
    where: { id: tie.id },
  });
}

export async function deleteFixtureMatch(params: {
  actorUserId: string;
  tournamentSlug: string;
  matchId: string;
}) {
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const match = await prisma.fixtureMatch.findFirst({
    where: { id: params.matchId, tournamentId },
    select: {
      id: true,
      status: true,
      sideOneScore: true,
      sideTwoScore: true,
      winnerSide: true,
    },
  });
  if (!match) {
    throw new TournamentServiceError("Match not found.");
  }
  if (matchHasLockedResult(match)) {
    throw new TournamentServiceError("Cannot delete a match after results have been recorded.");
  }
  await prisma.fixtureMatch.delete({
    where: { id: match.id },
  });
}

export async function createSinglesMatch(params: {
  actorUserId: string;
  tournamentSlug: string;
  playerOneId: string;
  playerTwoId: string;
  categoryLabel?: string;
}) {
  if (params.playerOneId === params.playerTwoId) {
    throw new TournamentServiceError("Select two different players.");
  }
  const tournamentId = await assertTournamentOwnership(params.tournamentSlug, params.actorUserId);
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, deletedAt: null },
    select: { id: true, format: true },
  });
  if (!tournament) throw new TournamentServiceError("Tournament not found.");
  if (tournament.format === TournamentFormat.DOUBLES_ONLY) {
    throw new TournamentServiceError(
      "This tournament is doubles-only. Singles fixtures are disabled.",
    );
  }
  const players = await prisma.player.findMany({
    where: {
      id: { in: [params.playerOneId, params.playerTwoId] },
      tournamentId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (players.length !== 2) {
    throw new TournamentServiceError("Players not found in this tournament.");
  }
  if (!fixturesDelegatesAvailable()) {
    throw new TournamentServiceError(
      "Fixtures schema is not ready yet. Run database migration first.",
    );
  }

  const match = await prisma.fixtureMatch.create({
    data: {
      tournamentId,
      matchType: FixtureMatchType.SINGLES,
      status: FixtureStatus.SCHEDULED,
      categoryLabel: params.categoryLabel,
      participants: {
        create: [
          { playerId: params.playerOneId, side: FixtureSide.SIDE_ONE },
          { playerId: params.playerTwoId, side: FixtureSide.SIDE_TWO },
        ],
      },
    },
  });
  return match.id;
}
