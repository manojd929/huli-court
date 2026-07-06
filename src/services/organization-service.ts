import { OrgRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export class OrganizationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationServiceError";
  }
}

function slugifyOrgName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "league";
}

async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugifyOrgName(name);
  const existing = await prisma.organization.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  if (!existing.some((org) => org.slug === base)) return base;
  const taken = new Set(existing.map((org) => org.slug));
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new OrganizationServiceError("Could not generate a unique league URL.");
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

export async function createOrganizationWithOwner(params: {
  userId: string;
  name: string;
}): Promise<{ organizationId: string; slug: string }> {
  const trimmed = params.name.trim();
  if (trimmed.length < 2) {
    throw new OrganizationServiceError("League name is too short.");
  }
  // Retry on the rare slug-collision race so signup never hard-fails on it.
  let slug = await uniqueOrgSlug(trimmed);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const organization = await prisma.organization.create({
        data: {
          name: trimmed,
          slug,
          memberships: {
            create: { userId: params.userId, role: OrgRole.OWNER },
          },
        },
      });
      return { organizationId: organization.id, slug: organization.slug };
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) {
        slug = `${slugifyOrgName(trimmed)}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      throw e;
    }
  }
  throw new OrganizationServiceError("Could not create the workspace. Try again.");
}

/**
 * Org IDs where the user can manage tournaments (OWNER or ADMIN membership).
 */
export async function getManagedOrganizationIds(
  userId: string,
): Promise<string[]> {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId,
      role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
      organization: { deletedAt: null },
    },
    select: { organizationId: true },
  });
  return memberships.map((m) => m.organizationId);
}

/**
 * The org new tournaments attach to. Existing users without one get a personal
 * org created lazily, so legacy commissioners onboard to tenancy transparently.
 */
export async function ensureOrganizationForUser(
  userId: string,
): Promise<string> {
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId,
      role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
      organization: { deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (membership) return membership.organizationId;

  const profile = await prisma.userProfile.findFirst({
    where: { id: userId, deletedAt: null },
    select: { displayName: true, email: true },
  });
  const fallbackName =
    profile?.displayName?.trim() ||
    profile?.email?.split("@")[0] ||
    "My";
  const { organizationId } = await createOrganizationWithOwner({
    userId,
    name: `${fallbackName} League`,
  });
  return organizationId;
}

/** True when the user created the tournament or manages its organization. */
export async function userCanManageTournament(
  userId: string,
  tournament: { createdById: string; organizationId: string | null },
): Promise<boolean> {
  if (tournament.createdById === userId) return true;
  if (!tournament.organizationId) return false;
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId,
      organizationId: tournament.organizationId,
      role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
    },
    select: { id: true },
  });
  return membership !== null;
}
