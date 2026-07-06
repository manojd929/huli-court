import "dotenv/config";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Gender, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createTeam,
  createTournament,
  reconcileSquadRulesForTournament,
  syncOwnerPlayersForTournament,
} from "@/services/tournament-service";

const DEFAULT_TOURNAMENT_NAME = "Hanuman cup";
const MAX_AUTH_LIST_PAGES = 50;

const QA_ADMIN = {
  email: "admin@draftforge.com",
  password: "admin@draftforge",
  displayName: "HuliCourt Admin",
} as const;

const QA_OWNERS = [
  { email: "ravi.qa@example.com", password: "RaviQa@2026", displayName: "Ravi", teamName: "QA Smash Bros" },
  { email: "karthik.qa@example.com", password: "KarthikQa@2026", displayName: "Karthik", teamName: "QA Net Ninjas" },
  { email: "ankit.qa@example.com", password: "AnkitQa@2026", displayName: "Ankit", teamName: "QA Shuttle Squad" },
  { email: "rohit.qa@example.com", password: "RohitQa@2026", displayName: "Rohit", teamName: "QA Drop Shot Kings" },
] as const;

const QA_PLAYER_BASE_NAMES = [
  "Rahul","Arjun","Vikram","Sandeep","Prakash","Nikhil","Varun","Abhishek","Deepak","Manoj",
  "Shreyas","Ajay","Saurav","Amit","Naveen","Tarun","Harish","Vignesh","Ganesh","Sunil",
  "Ramesh","Imran","Faizan","Sameer","Kunal","Pavan","Raghav","Siddharth","Tejas","Mohit",
  "Aditya","Karthik","Rohit","Ankit","Vivek","Lokesh","Pranav","Srinath","Dinesh","Jagadeesh",
  "Yash","Ritwik","Ashwin","Murali","Sai","Pradeep","Rohit","Shubham","Aakash","Hemant",
  "Naveen","Sanjay","Krishna","Bharath","Nitin","Uday","Ravi","Jatin","Kishore","Vasu",
  "Hitesh","Niraj","Dhruv","Parth","Harsha","Lakshman","Anirudh","Chirag","Rupesh","Tanish",
  "Yogesh","Prem","Saketh","Arvind","Suhas","Ronit","Mayank","Girish","Naresh","Suraj",
] as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createServiceRoleClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findAuthUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  for (let pages = 0; pages < MAX_AUTH_LIST_PAGES; pages += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const hit = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function ensureProfileByEmail(params: {
  authUserId: string;
  email: string;
  role: UserRole;
  displayName: string;
}): Promise<void> {
  const existingByEmail = await prisma.userProfile.findUnique({ where: { email: params.email } });

  if (existingByEmail && existingByEmail.id !== params.authUserId) {
    await prisma.userProfile.update({
      where: { id: existingByEmail.id },
      data: {
        email: `${existingByEmail.id}.relinked.${params.email}`,
      },
    });
  }

  await prisma.userProfile.upsert({
    where: { id: params.authUserId },
    create: {
      id: params.authUserId,
      email: params.email,
      displayName: params.displayName,
      role: params.role,
    },
    update: {
      email: params.email,
      displayName: params.displayName,
      role: params.role,
      deletedAt: null,
    },
  });
}

async function ensureAuthUserWithProfile(params: {
  admin: SupabaseClient;
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}): Promise<string> {
  const existingId = await findAuthUserIdByEmail(params.admin, params.email);

  if (existingId) {
    const { error } = await params.admin.auth.admin.updateUserById(existingId, {
      email_confirm: true,
      password: params.password,
      user_metadata: { full_name: params.displayName },
    });
    if (error) throw error;

    await ensureProfileByEmail({
      authUserId: existingId,
      email: params.email,
      role: params.role,
      displayName: params.displayName,
    });

    return existingId;
  }

  const { data, error } = await params.admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: params.displayName },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`Supabase Admin did not return a user for ${params.email}`);

  await ensureProfileByEmail({
    authUserId: data.user.id,
    email: params.email,
    role: params.role,
    displayName: params.displayName,
  });

  return data.user.id;
}

async function ensureTournament(commissionerId: string, name: string): Promise<{ id: string; slug: string }> {
  const existing = await prisma.tournament.findFirst({
    where: { name, deletedAt: null },
    select: { id: true, slug: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return existing;

  const { slug } = await createTournament(commissionerId, { name, picksPerTeam: 20 });
  const created = await prisma.tournament.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, slug: true },
  });

  if (!created) throw new Error("Tournament was not found immediately after create.");
  return created;
}

async function ensureTeam(tournamentSlug: string, commissionerId: string, name: string, ownerUserId: string): Promise<void> {
  const tournament = await prisma.tournament.findFirst({ where: { slug: tournamentSlug, deletedAt: null }, select: { id: true } });
  if (!tournament) throw new Error("Tournament missing when ensuring teams.");

  const existing = await prisma.team.findFirst({
    where: { tournamentId: tournament.id, name, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    await createTeam(commissionerId, { tournamentSlug, name, ownerUserId });
    return;
  }

  await prisma.team.update({ where: { id: existing.id }, data: { ownerUserId } });
}

function buildQaPlayers(): Array<{ name: string; tag: string }> {
  return QA_PLAYER_BASE_NAMES.map((name, index) => {
    const tier = index % 3 === 0 ? "advanced" : index % 3 === 1 ? "intermediate" : "beginner";
    return { name: `QA ${name} ${String(index + 1).padStart(2, "0")}`, tag: tier };
  });
}

async function seedQaPlayers(tournamentId: string, rosterCategoryId: string): Promise<number> {
  const existingNames = new Set(
    (
      await prisma.player.findMany({
        where: { tournamentId, deletedAt: null },
        select: { name: true },
      })
    ).map((player) => player.name),
  );

  const candidates = buildQaPlayers().filter((player) => !existingNames.has(player.name));

  if (candidates.length === 0) return 0;

  await prisma.player.createMany({
    data: candidates.map((player) => ({
      tournamentId,
      name: player.name,
      rosterCategoryId,
      gender: Gender.MALE,
      notes: `QA tag: ${player.tag}`,
    })),
  });

  return candidates.length;
}

async function ensurePlayableRosterCategory(tournamentId: string): Promise<string> {
  const intermediateCategory = await prisma.rosterCategory.findFirst({
    where: { tournamentId, stableKey: "MEN_INTERMEDIATE", archivedAt: null },
    select: { id: true },
  });
  if (intermediateCategory) return intermediateCategory.id;

  const fallbackCategory = await prisma.rosterCategory.findFirst({
    where: { tournamentId, archivedAt: null },
    select: { id: true },
    orderBy: { displayOrder: "asc" },
  });
  if (fallbackCategory) return fallbackCategory.id;

  const createdCategory = await prisma.rosterCategory.create({
    data: {
      tournamentId,
      name: "QA Open Category",
      displayOrder: 0,
      colorHex: "#0f766e",
    },
    select: { id: true },
  });

  return createdCategory.id;
}

async function main(): Promise<void> {
  if (process.env.VERCEL === "1") {
    throw new Error("QA seed must not run on Vercel.");
  }

  requireEnv("DATABASE_URL");
  const adminUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createServiceRoleClient(adminUrl, serviceKey);

  const commissionerId = await ensureAuthUserWithProfile({
    admin,
    email: QA_ADMIN.email,
    password: QA_ADMIN.password,
    displayName: QA_ADMIN.displayName,
    role: UserRole.ADMIN,
  });

  const ownerAccounts = await Promise.all(
    QA_OWNERS.map(async (owner) => ({
      ...owner,
      userId: await ensureAuthUserWithProfile({
        admin,
        email: owner.email,
        password: owner.password,
        displayName: owner.displayName,
        role: UserRole.OWNER,
      }),
    })),
  );

  const tournament = await ensureTournament(commissionerId, DEFAULT_TOURNAMENT_NAME);

  for (const owner of ownerAccounts) {
    await ensureTeam(tournament.slug, commissionerId, owner.teamName, owner.userId);
  }

  await syncOwnerPlayersForTournament(tournament.id);

  const rosterCategoryId = await ensurePlayableRosterCategory(tournament.id);
  const insertedCount = await seedQaPlayers(tournament.id, rosterCategoryId);
  await reconcileSquadRulesForTournament(tournament.id);

  const baseUrl = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || "http://localhost:3001";

  console.info("\n── QA tournament ready ──");
  console.info(`Slug: ${tournament.slug}`);
  console.info(`Hub: ${baseUrl}/tournament/${tournament.slug}`);
  console.info(`Admin: ${baseUrl}/tournament/${tournament.slug}/admin`);
  console.info(`Inserted QA players this run: ${String(insertedCount)}`);
  console.info(`Admin login: ${QA_ADMIN.email} / ${QA_ADMIN.password}`);
  for (const owner of ownerAccounts) {
    console.info(`${owner.teamName}: ${owner.email} / ${owner.password}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
