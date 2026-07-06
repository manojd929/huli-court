import { prisma } from "@/lib/prisma";
import {
  ensureOrganizationForUser,
  getManagedOrganizationIds,
} from "@/services/organization-service";

export class LeagueServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeagueServiceError";
  }
}

function slugifyLeagueName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "league";
}

async function uniqueLeagueSlug(name: string): Promise<string> {
  const base = slugifyLeagueName(name);
  const existing = await prisma.league.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((l) => l.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new LeagueServiceError("Could not generate a unique league URL.");
}

export interface CreateLeagueInput {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  colorHex?: string | null;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

export async function createLeague(
  userId: string,
  input: CreateLeagueInput,
): Promise<{ id: string; slug: string }> {
  const trimmed = input.name.trim();
  if (trimmed.length < 2) {
    throw new LeagueServiceError("League name is too short.");
  }
  const organizationId = await ensureOrganizationForUser(userId);
  const data = {
    organizationId,
    name: trimmed,
    description: input.description?.trim() ? input.description.trim() : null,
    logoUrl: input.logoUrl?.trim() ? input.logoUrl.trim() : null,
    colorHex: input.colorHex?.trim() ? input.colorHex.trim() : null,
  };
  // Retry on the rare slug-collision race (two concurrent creates computing the
  // same slug) rather than failing the whole request.
  let slug = await uniqueLeagueSlug(trimmed);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const league = await prisma.league.create({ data: { ...data, slug } });
      return { id: league.id, slug: league.slug };
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) {
        slug = `${slugifyLeagueName(trimmed)}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      throw e;
    }
  }
  throw new LeagueServiceError("Could not create the league. Try again.");
}

/** Leagues the user can manage, with a live tournament count. */
export async function listLeaguesForUser(userId: string) {
  const orgIds = await getManagedOrganizationIds(userId);
  if (orgIds.length === 0) return [];
  return prisma.league.findMany({
    where: { organizationId: { in: orgIds }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      colorHex: true,
      _count: {
        select: { tournaments: { where: { deletedAt: null } } },
      },
    },
  });
}

/** Leagues a user may attach a new tournament to (for the create-form picker). */
export async function listLeagueOptionsForUser(userId: string) {
  const orgIds = await getManagedOrganizationIds(userId);
  if (orgIds.length === 0) return [];
  return prisma.league.findMany({
    where: { organizationId: { in: orgIds }, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Public league home: branding + its (non-deleted) tournaments. */
export async function getLeagueBySlug(slug: string) {
  return prisma.league.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      colorHex: true,
      organizationId: true,
      tournaments: {
        where: { deletedAt: null },
        orderBy: [{ season: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          sport: true,
          format: true,
          season: true,
          draftPhase: true,
          _count: {
            select: {
              teams: { where: { deletedAt: null } },
              players: { where: { deletedAt: null } },
            },
          },
        },
      },
    },
  });
}

export async function userCanManageLeague(
  userId: string,
  league: { organizationId: string },
): Promise<boolean> {
  const orgIds = await getManagedOrganizationIds(userId);
  return orgIds.includes(league.organizationId);
}

export interface UpdateLeagueInput {
  slug: string;
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
  colorHex?: string | null;
}

export async function updateLeague(
  userId: string,
  input: UpdateLeagueInput,
): Promise<void> {
  const league = await prisma.league.findFirst({
    where: { slug: input.slug, deletedAt: null },
    select: { id: true, organizationId: true },
  });
  if (!league) throw new LeagueServiceError("League not found.");
  if (!(await userCanManageLeague(userId, league))) {
    throw new LeagueServiceError("You do not have access to this league.");
  }

  const data: {
    name?: string;
    description?: string | null;
    logoUrl?: string | null;
    colorHex?: string | null;
  } = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length < 2) throw new LeagueServiceError("League name is too short.");
    data.name = trimmed;
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() ? input.description.trim() : null;
  }
  if (input.logoUrl !== undefined) {
    data.logoUrl = input.logoUrl?.trim() ? input.logoUrl.trim() : null;
  }
  if (input.colorHex !== undefined) {
    data.colorHex = input.colorHex?.trim() ? input.colorHex.trim() : null;
  }
  await prisma.league.update({ where: { id: league.id }, data });
}

/**
 * Validates that a league the user is attaching a tournament to exists and is
 * theirs to manage. Returns the leagueId or throws.
 */
export async function assertLeagueManageable(
  userId: string,
  leagueId: string,
): Promise<string> {
  const league = await prisma.league.findFirst({
    where: { id: leagueId, deletedAt: null },
    select: { id: true, organizationId: true },
  });
  if (!league) throw new LeagueServiceError("League not found.");
  if (!(await userCanManageLeague(userId, league))) {
    throw new LeagueServiceError("You do not have access to this league.");
  }
  return league.id;
}
