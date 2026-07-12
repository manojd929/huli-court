import type { Prisma } from "@/generated/prisma/client";

import { DraftPhase } from "@/generated/prisma/enums";
import {
  OWNER_STUB_ROSTER_CATEGORY_STABLE_KEY,
  getDefaultRosterCategorySeeds,
  type TournamentFormat,
} from "@/lib/roster/default-roster-category-seeds";
import { DEFAULT_PICKS_PER_TEAM } from "@/constants/tournament-defaults";
import { prisma } from "@/lib/prisma";
import { TournamentServiceError } from "@/services/tournament-errors";

/**
 * Permissive default squad cap for a newly created/restored roster group.
 * Must never be 0 — a 0 cap silently blocks every bid and draft pick in that
 * category. Falls back to picksPerTeam so the group imposes no accidental
 * limit; commissioners tighten caps from the Rules page.
 */
async function defaultSquadCapForTournament(
  client: Prisma.TransactionClient | typeof prisma,
  tournamentId: string,
): Promise<number> {
  const tournament = await client.tournament.findFirst({
    where: { id: tournamentId },
    select: { picksPerTeam: true },
  });
  return tournament?.picksPerTeam ?? DEFAULT_PICKS_PER_TEAM;
}

import type {
  ArchiveRosterCategoryInput,
  CreateRosterCategoryInput,
  MoveRosterCategoryOrderInput,
  RestoreRosterCategoryInput,
  UpdateRosterCategoryInput,
} from "@/validations/roster-category";

async function assertCategoryEditorAccess(slug: string, userId: string): Promise<string> {
  const tournament = await prisma.tournament.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, createdById: true, draftPhase: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }
  if (tournament.createdById !== userId) {
    throw new TournamentServiceError("You do not have access to this tournament.");
  }
  if (tournament.draftPhase !== DraftPhase.SETUP && tournament.draftPhase !== DraftPhase.READY) {
    throw new TournamentServiceError(
      "Cannot change roster groups after the draft configuration is sealed.",
    );
  }
  return tournament.id;
}

export async function seedDefaultRosterCategories(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  format: TournamentFormat = "MIXED",
): Promise<void> {
  const seeds = getDefaultRosterCategorySeeds(format);
  for (const seed of seeds) {
    await tx.rosterCategory.create({
      data: {
        tournamentId,
        name: seed.name,
        displayOrder: seed.displayOrder,
        colorHex: seed.colorHex,
        stableKey: seed.stableKey,
      },
    });
  }
}

export async function resolveOwnerStubCategoryIdTx(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<string> {
  const preferred = await tx.rosterCategory.findFirst({
    where: {
      tournamentId,
      archivedAt: null,
      stableKey: OWNER_STUB_ROSTER_CATEGORY_STABLE_KEY,
    },
    select: { id: true },
  });
  if (preferred?.id) {
    return preferred.id;
  }
  const fallback = await tx.rosterCategory.findFirst({
    where: { tournamentId, archivedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (fallback?.id) {
    return fallback.id;
  }
  throw new TournamentServiceError("Add at least one roster group before assigning team owners.");
}

export async function createRosterCategory(
  userId: string,
  input: CreateRosterCategoryInput,
): Promise<void> {
  const tournamentId = await assertCategoryEditorAccess(input.tournamentSlug, userId);
  const maxOrderRow = await prisma.rosterCategory.aggregate({
    where: { tournamentId },
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrderRow._max.displayOrder ?? -1) + 1;
  const created = await prisma.rosterCategory.create({
    data: {
      tournamentId,
      name: input.name.trim(),
      displayOrder: input.displayOrder ?? nextOrder,
      colorHex:
        typeof input.colorHex === "string" && input.colorHex.trim() !== ""
          ? input.colorHex.trim()
          : null,
    },
    select: { id: true },
  });
  await prisma.squadRule.create({
    data: {
      tournamentId,
      rosterCategoryId: created.id,
      maxCount: await defaultSquadCapForTournament(prisma, tournamentId),
    },
  });
}

export async function updateRosterCategory(
  userId: string,
  input: UpdateRosterCategoryInput,
): Promise<void> {
  const tournamentId = await assertCategoryEditorAccess(input.tournamentSlug, userId);
  const existing = await prisma.rosterCategory.findFirst({
    where: {
      id: input.rosterCategoryId,
      tournamentId,
    },
    select: { id: true, archivedAt: true },
  });
  if (!existing) {
    throw new TournamentServiceError("Roster group not found.");
  }
  if (existing.archivedAt !== null) {
    throw new TournamentServiceError("Restore archived roster groups before editing them.");
  }
  await prisma.rosterCategory.update({
    where: { id: existing.id },
    data: {
      name: input.name.trim(),
      displayOrder: input.displayOrder,
      colorHex:
        typeof input.colorHex === "string" && input.colorHex.trim() !== ""
          ? input.colorHex.trim()
          : null,
    },
  });
}

export async function archiveRosterCategory(
  userId: string,
  input: ArchiveRosterCategoryInput,
): Promise<void> {
  const tournamentId = await assertCategoryEditorAccess(input.tournamentSlug, userId);
  const existing = await prisma.rosterCategory.findFirst({
    where: {
      id: input.rosterCategoryId,
      tournamentId,
    },
    select: { archivedAt: true },
  });
  if (!existing) throw new TournamentServiceError("Roster group not found.");
  const activeOthers = await prisma.rosterCategory.count({
    where: {
      tournamentId,
      archivedAt: null,
      NOT: { id: input.rosterCategoryId },
    },
  });
  if (existing.archivedAt === null && activeOthers === 0) {
    throw new TournamentServiceError(
      "Keep at least one other active roster group before archiving this row.",
    );
  }

  const playerCount = await prisma.player.count({
    where: {
      tournamentId,
      rosterCategoryId: input.rosterCategoryId,
      deletedAt: null,
    },
  });
  if (playerCount > 0) {
    throw new TournamentServiceError(
      "Move players to another roster group before archiving this one.",
    );
  }

  await prisma.rosterCategory.update({
    where: { id: input.rosterCategoryId },
    data: { archivedAt: new Date() },
  });
}

export async function restoreRosterCategory(
  userId: string,
  input: RestoreRosterCategoryInput,
): Promise<void> {
  const tournamentId = await assertCategoryEditorAccess(input.tournamentSlug, userId);
  const existing = await prisma.rosterCategory.findFirst({
    where: {
      id: input.rosterCategoryId,
      tournamentId,
    },
    select: { id: true, archivedAt: true },
  });
  if (!existing) {
    throw new TournamentServiceError("Roster group not found.");
  }
  if (existing.archivedAt === null) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.rosterCategory.update({
      where: { id: existing.id },
      data: { archivedAt: null },
    });

    const squad = await tx.squadRule.findFirst({
      where: { tournamentId, rosterCategoryId: existing.id },
      select: { id: true },
    });
    if (!squad) {
      await tx.squadRule.create({
        data: {
          tournamentId,
          rosterCategoryId: existing.id,
          maxCount: await defaultSquadCapForTournament(tx, tournamentId),
        },
      });
    }

    await normalizeActiveRosterDisplayOrderTx(tx, tournamentId);
  });
}

export async function moveRosterCategoryDisplayOrder(
  userId: string,
  input: MoveRosterCategoryOrderInput,
): Promise<void> {
  const tournamentId = await assertCategoryEditorAccess(input.tournamentSlug, userId);
  await prisma.$transaction(async (tx) => {
    const rows = await tx.rosterCategory.findMany({
      where: { tournamentId, archivedAt: null },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    const i = rows.findIndex((row) => row.id === input.rosterCategoryId);
    if (i === -1) {
      throw new TournamentServiceError("Roster group not found.");
    }
    const delta = input.direction === "up" ? -1 : 1;
    const j = i + delta;
    if (j < 0 || j >= rows.length) {
      return;
    }
    const reordered = [...rows];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    for (let k = 0; k < reordered.length; k += 1) {
      await tx.rosterCategory.update({
        where: { id: reordered[k].id },
        data: { displayOrder: k },
      });
    }
  });
}

async function normalizeActiveRosterDisplayOrderTx(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<void> {
  const rows = await tx.rosterCategory.findMany({
    where: { tournamentId, archivedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  await Promise.all(
    rows.map((row, idx) =>
      tx.rosterCategory.update({
        where: { id: row.id },
        data: { displayOrder: idx },
      }),
    ),
  );
}

export async function assertActiveRosterCategoryForPlayerTx(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  rosterCategoryId: string,
): Promise<void> {
  const cat = await tx.rosterCategory.findFirst({
    where: {
      id: rosterCategoryId,
      tournamentId,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!cat) {
    throw new TournamentServiceError(
      "Pick an active roster group from this tournament (archived groups cannot assign players).",
    );
  }
}

export async function assertActiveRosterCategoryForPlayer(
  tournamentId: string,
  rosterCategoryId: string,
): Promise<void> {
  const cat = await prisma.rosterCategory.findFirst({
    where: {
      id: rosterCategoryId,
      tournamentId,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!cat) {
    throw new TournamentServiceError(
      "Pick an active roster group from this tournament (archived groups cannot assign players).",
    );
  }
}
