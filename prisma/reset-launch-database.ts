import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import { PrismaClient, UserRole } from "../src/generated/prisma/client";

type AuthUserSummary = {
  email: string | null;
  id: string;
};

type CleanupCounts = {
  draftLogs: number;
  draftOrderSlots: number;
  fixtureMatches: number;
  fixtureParticipants: number;
  fixtureTies: number;
  picks: number;
  players: number;
  rosterCategories: number;
  squadRules: number;
  teams: number;
  tournaments: number;
  userProfilesRemoved: number;
};

const COMMISSIONER_EMAIL = process.env.LAUNCH_COMMISSIONER_EMAIL?.trim() || "admin@draftforge.com";
const COMMISSIONER_PASSWORD =
  process.env.LAUNCH_COMMISSIONER_PASSWORD?.trim() || "admin@draftforge";
const COMMISSIONER_DISPLAY_NAME =
  process.env.LAUNCH_COMMISSIONER_DISPLAY_NAME?.trim() || "HuliCourt Admin";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function listAllAuthUsers(): Promise<AuthUserSummary[]> {
  const adminClient = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const users: AuthUserSummary[] = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Could not list Supabase users: ${error.message}`);
    }

    for (const user of data.users) {
      users.push({
        id: user.id,
        email: user.email ?? null,
      });
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function deleteAuthUsers(users: AuthUserSummary[]): Promise<number> {
  if (users.length === 0) {
    return 0;
  }

  const adminClient = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  let deletedCount = 0;

  for (const user of users) {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Could not delete Supabase user ${user.email ?? user.id}: ${error.message}`);
    }
    deletedCount += 1;
  }

  return deletedCount;
}

async function createCommissionerAuthUser(): Promise<AuthUserSummary> {
  const adminClient = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data, error } = await adminClient.auth.admin.createUser({
    email: COMMISSIONER_EMAIL,
    password: COMMISSIONER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: COMMISSIONER_DISPLAY_NAME,
    },
  });

  if (error) {
    throw new Error(`Could not create commissioner auth user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Supabase did not return the commissioner auth user.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? COMMISSIONER_EMAIL,
  };
}

async function main(): Promise<void> {
  const connectionString = requireEnv("DATABASE_URL");
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existingAuthUsers = await listAllAuthUsers();

    const countsBefore = await Promise.all([
      prisma.tournament.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.pick.count(),
      prisma.draftLog.count(),
      prisma.draftOrderSlot.count(),
      prisma.rosterCategory.count(),
      prisma.squadRule.count(),
      prisma.fixtureTie.count(),
      prisma.fixtureMatch.count(),
      prisma.fixtureMatchParticipant.count(),
      prisma.userProfile.count(),
    ]);

    const cleanupCounts: CleanupCounts = {
      tournaments: countsBefore[0],
      teams: countsBefore[1],
      players: countsBefore[2],
      picks: countsBefore[3],
      draftLogs: countsBefore[4],
      draftOrderSlots: countsBefore[5],
      rosterCategories: countsBefore[6],
      squadRules: countsBefore[7],
      fixtureTies: countsBefore[8],
      fixtureMatches: countsBefore[9],
      fixtureParticipants: countsBefore[10],
      userProfilesRemoved: Math.max(countsBefore[11] - 1, 0),
    };

    await prisma.$transaction([
      prisma.tournament.deleteMany({}),
      prisma.userProfile.deleteMany({}),
    ]);

    const deletedAuthUsers = await deleteAuthUsers(existingAuthUsers);
    const commissionerAuthUser = await createCommissionerAuthUser();

    await prisma.userProfile.create({
      data: {
        id: commissionerAuthUser.id,
        email: commissionerAuthUser.email ?? COMMISSIONER_EMAIL,
        displayName: COMMISSIONER_DISPLAY_NAME,
        role: UserRole.ADMIN,
      },
    });

    const countsAfter = await Promise.all([
      prisma.tournament.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.pick.count(),
      prisma.draftLog.count(),
      prisma.draftOrderSlot.count(),
      prisma.rosterCategory.count(),
      prisma.squadRule.count(),
      prisma.fixtureTie.count(),
      prisma.fixtureMatch.count(),
      prisma.fixtureMatchParticipant.count(),
      prisma.userProfile.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          email: true,
          id: true,
          role: true,
          deletedAt: true,
        },
      }),
    ]);

    console.info(
      JSON.stringify(
        {
          commissioner: {
            email: COMMISSIONER_EMAIL,
            password: COMMISSIONER_PASSWORD,
          },
          deletedAuthUsers,
          removedData: cleanupCounts,
          remaining: {
            tournaments: countsAfter[0],
            teams: countsAfter[1],
            players: countsAfter[2],
            picks: countsAfter[3],
            draftLogs: countsAfter[4],
            draftOrderSlots: countsAfter[5],
            rosterCategories: countsAfter[6],
            squadRules: countsAfter[7],
            fixtureTies: countsAfter[8],
            fixtureMatches: countsAfter[9],
            fixtureParticipants: countsAfter[10],
            userProfiles: countsAfter[11],
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown failure";
  console.error(message);
  process.exitCode = 1;
});
