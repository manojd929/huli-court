import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { userCanManageTournament } from "@/services/organization-service";

export async function getTournamentBySlug(slug: string) {
  return prisma.tournament.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdById: true,
      organizationId: true,
      allocationMethod: true,
      picksPerTeam: true,
      logoUrl: true,
      colorHex: true,
      sport: true,
      format: true,
      draftPhase: true,
      playerEntryFeeMinorUnits: true,
      playerEntryFeeCurrencyCode: true,
    },
  });
}

export async function requireTournamentAccess(slug: string, userId: string) {
  const tournament = await getTournamentBySlug(slug);
  if (!tournament || !(await userCanManageTournament(userId, tournament))) {
    notFound();
  }
  return tournament;
}

/**
 * Can this user *view* a tournament: its creator, an org admin, or a franchise
 * owner who owns a team in it. (The public TV board at /tv is separate and
 * intentionally unauthenticated.)
 */
export async function userCanViewTournament(
  userId: string,
  tournament: { id: string; createdById: string; organizationId: string | null },
): Promise<boolean> {
  if (await userCanManageTournament(userId, tournament)) return true;
  const ownedTeam = await prisma.team.findFirst({
    where: { tournamentId: tournament.id, ownerUserId: userId, deletedAt: null },
    select: { id: true },
  });
  return ownedTeam !== null;
}

/**
 * Fetch a tournament and 404 unless the signed-in user may view it. Use in every
 * authenticated tournament page so cross-tenant users can't read rosters, teams,
 * owner emails, or live draft/auction state by guessing a slug.
 */
export async function requireTournamentViewAccess(slug: string, userId: string) {
  const tournament = await getTournamentBySlug(slug);
  if (!tournament || !(await userCanViewTournament(userId, tournament))) {
    notFound();
  }
  return tournament;
}
