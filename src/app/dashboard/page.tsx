import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteTournamentButton } from "@/features/dashboard/delete-tournament-button";
import { APP_NAME, ROUTES } from "@/constants/app";
import { DRAFT_PHASE_LABEL } from "@/constants/draft-phase-labels";
import { SPORT_META } from "@/constants/sport-meta";
import { TOURNAMENT_FORMAT_LABEL } from "@/constants/tournament-format-labels";
import { UserRole } from "@/generated/prisma/enums";
import {
  tournamentDashboardListSelect,
  type TournamentDashboardListRow,
} from "@/lib/data/tournament-dashboard-list-select";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getManagedOrganizationIds } from "@/services/organization-service";
import { listLeaguesForUser } from "@/services/league-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  let tournaments: TournamentDashboardListRow[] = [];
  let leagues: Awaited<ReturnType<typeof listLeaguesForUser>> = [];
  let loadError: string | null = null;
  let userRole: typeof UserRole.ADMIN | typeof UserRole.OWNER | null = null;
  try {
    const profile = await prisma.userProfile.findFirst({
      where: { id: user.id, deletedAt: null },
      select: { role: true },
    });
    userRole =
      profile?.role === UserRole.ADMIN || profile?.role === UserRole.OWNER
        ? profile.role
        : null;

    if (userRole === UserRole.ADMIN) {
      leagues = await listLeaguesForUser(user.id);
      const managedOrgIds = await getManagedOrganizationIds(user.id);
      tournaments = await prisma.tournament.findMany({
        where: {
          deletedAt: null,
          OR: [
            { createdById: user.id },
            ...(managedOrgIds.length > 0
              ? [{ organizationId: { in: managedOrgIds } }]
              : []),
          ],
        },
        orderBy: { updatedAt: "desc" },
        select: tournamentDashboardListSelect,
      });
    } else if (userRole === UserRole.OWNER) {
      tournaments = await prisma.tournament.findMany({
        where: {
          deletedAt: null,
          teams: {
            some: {
              deletedAt: null,
              ownerUserId: user.id,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        select: tournamentDashboardListSelect,
      });
    }
  } catch {
    loadError =
      "HuliCourt couldn't reach live data right now. Check back shortly, or contact your administrator if this continues.";
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 pb-14 sm:gap-10 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-accent sm:tracking-[0.2em]">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            {APP_NAME}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="dashboard-title">Your tournaments</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Set up teams and players, pick how squads are formed — draft, random, or a
            live auction — then run it on the shared board.
          </p>
        </div>
        {userRole === UserRole.ADMIN ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href={ROUTES.leagueNew}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "min-h-11 touch-manipulation justify-center",
              )}
            >
              New league
            </Link>
            <Link
              href={ROUTES.tournamentNew}
              className={cn(
                buttonVariants(),
                "min-h-11 touch-manipulation justify-center",
              )}
            >
              New tournament
            </Link>
          </div>
        ) : null}
      </header>

      {userRole === UserRole.ADMIN && leagues.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your leagues
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={ROUTES.league(league.slug)}
                className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm transition-colors hover:border-brand/50"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: league.colorHex ?? "#f2b21a" }}
                >
                  {league.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium group-hover:text-brand-accent">
                    {league.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {league._count.tournaments}{" "}
                    {league._count.tournaments === 1 ? "tournament" : "tournaments"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {loadError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Connection required</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <section className="grid gap-5 md:grid-cols-2">
          {tournaments.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>No tournaments yet</CardTitle>
                <CardDescription>
                  {userRole === UserRole.ADMIN
                    ? "Create one tournament. Then add teams, owners, and players before the auction."
                    : "No tournaments are assigned to your owner account yet. Ask your administrator to assign your team."}
                </CardDescription>
              </CardHeader>
              {userRole === UserRole.ADMIN ? (
                <CardContent>
                  <Link href={ROUTES.tournamentNew} className={cn(buttonVariants())}>
                    Create tournament
                  </Link>
                </CardContent>
              ) : null}
            </Card>
          ) : (
            tournaments.map((tournament) => (
              <Card key={tournament.id} className="border-border/70 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                  {userRole === UserRole.ADMIN ? (
                    <CardAction>
                      <DeleteTournamentButton
                        tournamentSlug={tournament.slug}
                        tournamentName={tournament.name}
                        iconOnly
                      />
                    </CardAction>
                  ) : null}
                  <div className="flex items-start justify-between gap-3 pr-2">
                    <div>
                      <CardTitle className="text-xl">{tournament.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        /{tournament.slug}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        (tournament.draftPhase === "LIVE" ||
                          tournament.draftPhase === "PAUSED") &&
                          "border-brand/40 bg-brand/15 text-brand-accent",
                      )}
                    >
                      {(tournament.draftPhase === "LIVE" ||
                        tournament.draftPhase === "PAUSED") && (
                        <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-brand align-middle" aria-hidden />
                      )}
                      {DRAFT_PHASE_LABEL[tournament.draftPhase]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>
                      {SPORT_META[tournament.sport].emoji}{" "}
                      {SPORT_META[tournament.sport].label}
                    </span>
                    <span>{tournament._count.teams} teams</span>
                    <span>{tournament._count.players} players</span>
                    <span>{TOURNAMENT_FORMAT_LABEL[tournament.format]}</span>
                  </div>
                  <div className="border-t border-border/60 pt-4">
                    <Link
                      href={ROUTES.tournament(tournament.slug)}
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "min-h-11 w-full touch-manipulation justify-center px-4 sm:min-h-9",
                      )}
                    >
                      Enter
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      )}
    </div>
  );
}
