import "dotenv/config";

import { OrgRole, UserRole } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

/**
 * One-time tenancy backfill: gives every ADMIN who created tournaments a
 * personal organization (if they lack one) and attaches their orphaned
 * tournaments to it. Idempotent — safe to re-run.
 *
 * Run after `prisma migrate deploy`:
 *   npx tsx prisma/backfill-organizations.ts
 */

function orgSlugFromEmail(email: string, taken: Set<string>): string {
  const base =
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "league";
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

async function main() {
  const admins = await prisma.userProfile.findMany({
    where: { role: UserRole.ADMIN, deletedAt: null },
    select: { id: true, email: true, displayName: true },
  });

  const existingSlugs = new Set(
    (await prisma.organization.findMany({ select: { slug: true } })).map((org) => org.slug),
  );

  let orgsCreated = 0;
  let tournamentsAttached = 0;

  for (const admin of admins) {
    let membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: admin.id,
        role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
      },
      select: { organizationId: true },
    });

    const orphanCount = await prisma.tournament.count({
      where: { createdById: admin.id, organizationId: null, deletedAt: null },
    });
    if (!membership && orphanCount === 0) continue;

    if (!membership) {
      const slug = orgSlugFromEmail(admin.email, existingSlugs);
      existingSlugs.add(slug);
      const organization = await prisma.organization.create({
        data: {
          name: `${admin.displayName?.trim() || admin.email.split("@")[0]} League`,
          slug,
          memberships: { create: { userId: admin.id, role: OrgRole.OWNER } },
        },
      });
      membership = { organizationId: organization.id };
      orgsCreated += 1;
    }

    const attached = await prisma.tournament.updateMany({
      where: { createdById: admin.id, organizationId: null, deletedAt: null },
      data: { organizationId: membership.organizationId },
    });
    tournamentsAttached += attached.count;
  }

  console.log(
    `Backfill complete: ${orgsCreated} organizations created, ${tournamentsAttached} tournaments attached.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
