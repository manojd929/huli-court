import { FixtureMatchType, FixtureSide } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function ensureTeamPlayers(params: {
  tournamentId: string;
  teamId: string;
  minCount: number;
  fallbackPrefix: string;
}): Promise<Array<{ id: string; name: string }>> {
  const [confirmedPicks, rosterCategory] = await Promise.all([
    prisma.pick.findMany({
      where: { tournamentId: params.tournamentId, teamId: params.teamId, status: "CONFIRMED" },
      orderBy: { createdAt: "asc" },
      include: {
        player: { select: { id: true, name: true, deletedAt: true } },
      },
    }),
    prisma.rosterCategory.findFirst({
      where: { tournamentId: params.tournamentId, archivedAt: null },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    }),
  ]);

  if (!rosterCategory) {
    throw new Error("No active roster category found. Add at least one roster category first.");
  }

  const uniquePlayers = new Map<string, { id: string; name: string }>();
  for (const pick of confirmedPicks) {
    if (pick.player && pick.player.deletedAt === null) {
      uniquePlayers.set(pick.player.id, { id: pick.player.id, name: pick.player.name });
    }
  }

  const missing = params.minCount - uniquePlayers.size;
  if (missing > 0) {
    for (let index = 0; index < missing; index += 1) {
      const player = await prisma.player.create({
        data: {
          tournamentId: params.tournamentId,
          rosterCategoryId: rosterCategory.id,
          name: `${params.fallbackPrefix} Test Player ${index + 1}`,
          gender: "OTHER",
        },
        select: { id: true, name: true },
      });
      uniquePlayers.set(player.id, player);
    }
  }

  return [...uniquePlayers.values()];
}

async function run() {
  requiredEnv("DATABASE_URL");
  const tournamentSlug = process.env.FIXTURE_TOURNAMENT_SLUG?.trim() || "clash-of-two-giants";

  const tournament = await prisma.tournament.findFirst({
    where: { slug: tournamentSlug, deletedAt: null },
    select: { id: true, name: true, format: true },
  });
  if (!tournament) {
    throw new Error(`Tournament not found for slug: ${tournamentSlug}`);
  }

  const ties = await prisma.fixtureTie.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ roundNumber: "asc" }, { sequence: "asc" }],
    include: {
      matches: {
        where: { matchType: FixtureMatchType.DOUBLES },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      },
      teamOne: { select: { id: true, name: true } },
      teamTwo: { select: { id: true, name: true } },
    },
  });

  if (ties.length === 0) {
    throw new Error("No fixture ties found. Generate ties first from the Fixtures page.");
  }

  console.info(`Patching doubles fixture test data for: ${tournament.name}`);

  for (const tie of ties) {
    const [teamOnePlayers, teamTwoPlayers] = await Promise.all([
      ensureTeamPlayers({
        tournamentId: tournament.id,
        teamId: tie.teamOne.id,
        minCount: 2,
        fallbackPrefix: tie.teamOne.name,
      }),
      ensureTeamPlayers({
        tournamentId: tournament.id,
        teamId: tie.teamTwo.id,
        minCount: 2,
        fallbackPrefix: tie.teamTwo.name,
      }),
    ]);

    for (const [matchIndex, match] of tie.matches.entries()) {
      const firstIndex = (matchIndex * 2) % teamOnePlayers.length;
      const secondIndex = (matchIndex * 2 + 1) % teamOnePlayers.length;
      const thirdIndex = (matchIndex * 2) % teamTwoPlayers.length;
      const fourthIndex = (matchIndex * 2 + 1) % teamTwoPlayers.length;

      const sideOne = [teamOnePlayers[firstIndex], teamOnePlayers[secondIndex]];
      const sideTwo = [teamTwoPlayers[thirdIndex], teamTwoPlayers[fourthIndex]];

      await prisma.fixtureMatchParticipant.deleteMany({ where: { matchId: match.id } });
      await prisma.fixtureMatchParticipant.createMany({
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

  console.info(`Updated ${ties.length} ties with doubles participants.`);
}

run()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown failure";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
