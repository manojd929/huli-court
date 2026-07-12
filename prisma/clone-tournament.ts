import "dotenv/config";

import { DraftPhase } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";
import { tournamentSlugFromName } from "../src/utils/tournament-slug";

type CloneTournamentOptions = {
  sourceSlug: string;
  targetName: string;
};

type SourceTournamentSnapshot = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  format: "DOUBLES_ONLY" | "MIXED" | "SINGLES_ONLY";
  logoUrl: string | null;
  colorHex: string | null;
  createdById: string;
  picksPerTeam: number;
  playerEntryFeeMinorUnits: number | null;
  playerEntryFeeCurrencyCode: string;
  activeAuctionRosterCategoryId: string | null;
  rosterCategories: Array<{
    id: string;
    name: string;
    displayOrder: number;
    colorHex: string | null;
    archivedAt: Date | null;
    stableKey: string | null;
  }>;
  squadRules: Array<{
    rosterCategoryId: string;
    maxCount: number;
  }>;
  teams: Array<{
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    colorHex: string | null;
    ownerUserId: string | null;
    displayOrder: number;
  }>;
  players: Array<{
    name: string;
    photoUrl: string | null;
    rosterCategoryId: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    notes: string | null;
    hasPaidEntryFee: boolean;
    isUnavailable: boolean;
    isLocked: boolean;
    isEliminated: boolean;
    linkedOwnerUserId: string | null;
    deletedAt: Date | null;
  }>;
};

function requireDatabaseUrl(): void {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required.");
  }
}

function parseArgs(argv: string[]): CloneTournamentOptions {
  const sourceSlug = argv[0]?.trim();
  const targetName = argv[1]?.trim();

  if (!sourceSlug || !targetName) {
    throw new Error("Usage: npm run tournament:clone -- <source-slug> <target-name>");
  }

  return {
    sourceSlug,
    targetName,
  };
}

async function loadSourceTournament(sourceSlug: string): Promise<SourceTournamentSnapshot> {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: sourceSlug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      format: true,
      logoUrl: true,
      colorHex: true,
      createdById: true,
      picksPerTeam: true,
      playerEntryFeeMinorUnits: true,
      playerEntryFeeCurrencyCode: true,
      activeAuctionRosterCategoryId: true,
      rosterCategories: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          displayOrder: true,
          colorHex: true,
          archivedAt: true,
          stableKey: true,
        },
      },
      squadRules: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          rosterCategoryId: true,
          maxCount: true,
        },
      },
      teams: {
        where: { deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          shortName: true,
          logoUrl: true,
          colorHex: true,
          ownerUserId: true,
          displayOrder: true,
        },
      },
      players: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          name: true,
          photoUrl: true,
          rosterCategoryId: true,
          gender: true,
          notes: true,
          hasPaidEntryFee: true,
          isUnavailable: true,
          isLocked: true,
          isEliminated: true,
          linkedOwnerUserId: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!tournament) {
    throw new Error(`Tournament not found for slug: ${sourceSlug}`);
  }

  return tournament;
}

async function assertProfilesExist(userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  const profiles = await prisma.userProfile.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true },
  });

  const foundIds = new Set(profiles.map((profile) => profile.id));
  const missingIds = userIds.filter((userId) => !foundIds.has(userId));
  if (missingIds.length > 0) {
    throw new Error(`Missing active user profiles for: ${missingIds.join(", ")}`);
  }
}

async function cloneTournament(options: CloneTournamentOptions): Promise<{
  sourceName: string;
  sourceSlug: string;
  targetSlug: string;
  playerCount: number;
  teamCount: number;
  ownerCount: number;
}> {
  const source = await loadSourceTournament(options.sourceSlug);
  const ownerIds = [
    ...new Set(
      source.teams
        .map((team) => team.ownerUserId)
        .filter((ownerUserId): ownerUserId is string => ownerUserId !== null),
    ),
  ];

  await assertProfilesExist([source.createdById, ...ownerIds]);

  const categoryIdMap = new Map<string, string>();
  const targetSlug = tournamentSlugFromName(options.targetName);

  await prisma.$transaction(async (tx) => {
    const createdTournament = await tx.tournament.create({
      data: {
        name: options.targetName,
        slug: targetSlug,
        description: source.description,
        format: source.format,
        logoUrl: source.logoUrl,
        colorHex: source.colorHex,
        createdById: source.createdById,
        picksPerTeam: source.picksPerTeam,
        draftPhase: DraftPhase.SETUP,
        currentSlotIndex: 0,
        draftOrderLocked: false,
        pendingPickPlayerId: null,
        pendingPickTeamId: null,
        pendingIdempotencyKey: null,
        overrideValidation: false,
        pickTimerSeconds: null,
        draftStartedAt: null,
        draftEndedAt: null,
        playerEntryFeeMinorUnits: source.playerEntryFeeMinorUnits,
        playerEntryFeeCurrencyCode: source.playerEntryFeeCurrencyCode,
      },
      select: { id: true },
    });

    for (const category of source.rosterCategories) {
      const createdCategory = await tx.rosterCategory.create({
        data: {
          tournamentId: createdTournament.id,
          name: category.name,
          displayOrder: category.displayOrder,
          colorHex: category.colorHex,
          archivedAt: category.archivedAt,
          stableKey: category.stableKey,
        },
        select: { id: true },
      });
      categoryIdMap.set(category.id, createdCategory.id);
    }

    await tx.squadRule.createMany({
      data: source.squadRules.map((rule) => {
        const rosterCategoryId = categoryIdMap.get(rule.rosterCategoryId);
        if (!rosterCategoryId) {
          throw new Error(
            `Missing roster category mapping for squad rule category ${rule.rosterCategoryId}`,
          );
        }

        return {
          tournamentId: createdTournament.id,
          rosterCategoryId,
          maxCount: rule.maxCount,
        };
      }),
    });

    if (source.teams.length > 0) {
      await tx.team.createMany({
        data: source.teams.map((team) => ({
          tournamentId: createdTournament.id,
          name: team.name,
          shortName: team.shortName,
          logoUrl: team.logoUrl,
          colorHex: team.colorHex,
          ownerUserId: team.ownerUserId,
          displayOrder: team.displayOrder,
          isEliminated: false,
        })),
      });
    }

    if (source.players.length > 0) {
      await tx.player.createMany({
        data: source.players.map((player) => {
          const rosterCategoryId = categoryIdMap.get(player.rosterCategoryId);
          if (!rosterCategoryId) {
            throw new Error(
              `Missing roster category mapping for player category ${player.rosterCategoryId}`,
            );
          }

          return {
            tournamentId: createdTournament.id,
            name: player.name,
            photoUrl: player.photoUrl,
            rosterCategoryId,
            gender: player.gender,
            notes: player.notes,
            hasPaidEntryFee: player.hasPaidEntryFee,
            isUnavailable: player.isUnavailable,
            isLocked: player.isLocked,
            isEliminated: false,
            linkedOwnerUserId: player.linkedOwnerUserId,
            deletedAt: player.deletedAt,
          };
        }),
      });
    }

    const activeAuctionRosterCategoryId = source.activeAuctionRosterCategoryId
      ? (categoryIdMap.get(source.activeAuctionRosterCategoryId) ?? null)
      : null;

    await tx.tournament.update({
      where: { id: createdTournament.id },
      data: { activeAuctionRosterCategoryId },
    });
  });

  return {
    sourceName: source.name,
    sourceSlug: source.slug,
    targetSlug,
    playerCount: source.players.filter((player) => player.deletedAt === null).length,
    teamCount: source.teams.length,
    ownerCount: ownerIds.length,
  };
}

async function main(): Promise<void> {
  requireDatabaseUrl();
  const options = parseArgs(process.argv.slice(2));
  const result = await cloneTournament(options);

  console.info(`Cloned tournament "${result.sourceName}" (${result.sourceSlug})`);
  console.info(`New tournament slug: ${result.targetSlug}`);
  console.info(
    `Copied ${result.playerCount} active players, ${result.teamCount} teams, and ${result.ownerCount} franchise owners.`,
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown failure";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
