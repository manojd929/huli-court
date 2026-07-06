import { AccountHeaderActions } from "@/components/auth/account-header-actions";
import { CreateTournamentForm } from "@/features/tournaments/create-tournament-form";
import { ROUTES } from "@/constants/app";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listLeagueOptionsForUser } from "@/services/league-service";

interface PageProps {
  searchParams: Promise<{ league?: string }>;
}

export default async function NewTournamentPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/tournament/new");
  }

  const profile = await prisma.userProfile.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { role: true },
  });
  if (!profile || profile.role !== UserRole.ADMIN) {
    redirect(ROUTES.dashboard);
  }

  const [leagues, { league: leagueSlug }] = await Promise.all([
    listLeagueOptionsForUser(user.id),
    searchParams,
  ]);
  // Resolve a ?league=<slug> prefill to its id (only if it's one the user manages).
  let defaultLeagueId = "";
  if (leagueSlug) {
    const match = await prisma.league.findFirst({
      where: { slug: leagueSlug, deletedAt: null },
      select: { id: true },
    });
    if (match && leagues.some((l) => l.id === match.id)) {
      defaultLeagueId = match.id;
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={ROUTES.dashboard} className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <AccountHeaderActions />
      </div>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight">Launch a tournament</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Name it, choose how teams are formed, and you&apos;re ready to add franchises
        and players. You can change most things later.
      </p>
      <div className="mt-12">
        <CreateTournamentForm leagues={leagues} defaultLeagueId={defaultLeagueId} />
      </div>
    </div>
  );
}
