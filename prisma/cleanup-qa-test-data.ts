/**
 * One-off cleanup of the QA test data created during production smoke testing.
 *
 * Removes:
 *   - Tournament "qa-test-auction-cup-gq0m2g" (cascades to its teams, players,
 *     squad rules, auction lots/bids, picks, draft logs).
 *   - The provisioned franchise-owner login qaowner1@hulicourt.com
 *     (Supabase auth user + its Prisma UserProfile).
 *
 * Leaves the 4 commissioner accounts and their organizations untouched.
 *
 * Usage:
 *   npx tsx prisma/cleanup-qa-test-data.ts          # dry run (prints plan)
 *   npx tsx prisma/cleanup-qa-test-data.ts --apply  # actually delete
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const TOURNAMENT_SLUG = "qa-test-auction-cup-gq0m2g";
const OWNER_EMAIL = "qaowner1@hulicourt.com";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function adminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const supabase = adminClient();
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const tournament = await prisma.tournament.findFirst({
      where: { slug: TOURNAMENT_SLUG },
      select: {
        id: true,
        name: true,
        _count: {
          select: { teams: true, players: true, picks: true, auctionLots: true },
        },
      },
    });

    const ownerAuthId = await findAuthUserByEmail(OWNER_EMAIL);
    const ownerProfile = ownerAuthId
      ? await prisma.userProfile.findFirst({
          where: { id: ownerAuthId },
          select: { id: true, email: true, role: true },
        })
      : null;

    console.log(`\n${apply ? "APPLYING" : "DRY RUN"} — QA test-data cleanup\n`);
    console.log(
      "Tournament:",
      tournament
        ? `${tournament.name} (${TOURNAMENT_SLUG}) — teams:${tournament._count.teams} players:${tournament._count.players} picks:${tournament._count.picks} lots:${tournament._count.auctionLots} [will cascade]`
        : `not found (already gone)`,
    );
    console.log("Owner auth user:", ownerAuthId ? `${OWNER_EMAIL} (${ownerAuthId})` : "not found");
    console.log(
      "Owner UserProfile:",
      ownerProfile ? `${ownerProfile.email} role=${ownerProfile.role}` : "not found",
    );

    if (!apply) {
      console.log("\nRe-run with --apply to execute.\n");
      return;
    }

    if (tournament) {
      await prisma.tournament.delete({ where: { id: tournament.id } });
      console.log("✓ Deleted tournament (cascaded children).");
    }
    if (ownerProfile) {
      await prisma.userProfile.delete({ where: { id: ownerProfile.id } });
      console.log("✓ Deleted owner UserProfile.");
    }
    if (ownerAuthId) {
      const { error } = await adminClient().auth.admin.deleteUser(ownerAuthId);
      if (error) throw new Error(`deleteUser failed: ${error.message}`);
      console.log("✓ Deleted owner Supabase auth user.");
    }

    const remaining = await prisma.tournament.count({ where: { deletedAt: null } });
    console.log(`\nDone. Live (non-deleted) tournaments remaining: ${remaining}\n`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
