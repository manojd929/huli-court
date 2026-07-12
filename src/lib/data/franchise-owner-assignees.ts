import { UserRole } from "@/generated/prisma/enums";
import type { AssignablePerson } from "@/types/assignable-person";
import { prisma } from "@/lib/prisma";

/**
 * People eligible to be franchise owners for this tournament only:
 * - Franchise-owner role (`UserRole.OWNER`), or already tied to this league (team owner / linked roster row).
 * - Excludes the tournament commissioner entirely (Admin runs separately; use another login).
 * - Excludes league admin accounts (`UserRole.ADMIN`); they run the auction, not franchise bidding.
 * - Excludes random VIEWER accounts that are not stakeholders in this tournament.
 * - Re-attaches profiles for current-team owners not covered above (odd legacy rows).
 *
 * Deliberately does NOT exclude people who already own a team in a different
 * tournament: a real person can plausibly be a franchise owner across several
 * different commissioners' tournaments (same login, different leagues), and
 * `deleteAuthUserIfNoOwnerReferences` already checks ownership globally before
 * ever deleting an account, so nothing else in the app assumes one team per
 * login platform-wide.
 */
export async function buildFranchiseOwnerAssigneeList(params: {
  tournamentId: string;
  commissionerUserId: string;
  existingTeamOwnerIds: string[];
}): Promise<AssignablePerson[]> {
  const linkedStakeholders = await prisma.player.findMany({
    where: {
      tournamentId: params.tournamentId,
      deletedAt: null,
      linkedOwnerUserId: { not: null },
    },
    select: { linkedOwnerUserId: true },
  });

  const stakeholderIds = new Set<string>();
  for (const id of params.existingTeamOwnerIds) {
    if (id.trim() !== "") stakeholderIds.add(id);
  }
  for (const row of linkedStakeholders) {
    if (row.linkedOwnerUserId) stakeholderIds.add(row.linkedOwnerUserId);
  }

  const stakeholderIdList = stakeholderIds.size > 0 ? [...stakeholderIds] : ([] as string[]);

  const candidates = await prisma.userProfile.findMany({
    where: {
      deletedAt: null,
      role: { not: UserRole.ADMIN },
      id: { not: params.commissionerUserId },
      OR: [
        { role: UserRole.OWNER },
        ...(stakeholderIdList.length > 0 ? [{ id: { in: stakeholderIdList } }] : []),
      ],
    },
    select: { id: true, email: true, displayName: true },
  });

  const assignableIds = new Set(candidates.map((person) => person.id));

  const orphanIds = params.existingTeamOwnerIds.filter(
    (id) => id.trim() !== "" && id !== params.commissionerUserId && !assignableIds.has(id),
  );

  const orphans =
    orphanIds.length > 0
      ? await prisma.userProfile.findMany({
          where: {
            id: { in: orphanIds },
            deletedAt: null,
            role: { not: UserRole.ADMIN },
          },
          select: { id: true, email: true, displayName: true },
        })
      : [];

  const merged = new Map<string, AssignablePerson>();
  for (const person of candidates) {
    merged.set(person.id, person);
  }
  for (const person of orphans) {
    merged.set(person.id, person);
  }

  return [...merged.values()].sort((a, b) => {
    const labelA = (a.displayName?.trim() ?? a.email).toLowerCase();
    const labelB = (b.displayName?.trim() ?? b.email).toLowerCase();
    return labelA.localeCompare(labelB);
  });
}
