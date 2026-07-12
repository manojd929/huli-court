import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/app";
import { DRAFT_PHASE_LABEL } from "@/constants/draft-phase-labels";
import { SPORT_META } from "@/constants/sport-meta";
import { TOURNAMENT_FORMAT_LABEL } from "@/constants/tournament-format-labels";
import { getSessionUser } from "@/lib/auth/session";
import { getLeagueBySlug, userCanManageLeague } from "@/services/league-service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const user = await getSessionUser();
  const canManage = user
    ? await userCanManageLeague(user.id, { organizationId: league.organizationId })
    : false;

  const accent = league.colorHex ?? "#f2b21a";
  const tournaments = league.tournaments;

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72"
        style={{
          background: `radial-gradient(60% 100% at 50% 0%, ${accent}22, transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {league.logoUrl ? (
              <Image
                src={league.logoUrl}
                alt={`${league.name} logo`}
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-2xl object-cover ring-1 ring-border"
                unoptimized
              />
            ) : (
              <div
                className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {league.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-brand-accent uppercase">
                League
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {league.name}
              </h1>
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={ROUTES.leagueEdit(league.slug)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Edit league
              </Link>
              <Link
                href={`${ROUTES.tournamentNew}?league=${league.slug}`}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                New tournament
              </Link>
            </div>
          ) : null}
        </header>

        {league.description ? (
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {league.description}
          </p>
        ) : null}

        <div className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">
            Tournaments{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({tournaments.length})
            </span>
          </h2>

          {tournaments.length === 0 ? (
            <Card className="mt-4 border-dashed">
              <CardHeader>
                <CardTitle>No tournaments yet</CardTitle>
                <CardDescription>
                  {canManage
                    ? "Add your first tournament to this league to kick off the season."
                    : "This league hasn’t published a tournament yet. Check back soon."}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {tournaments.map((t) => (
                <Link
                  key={t.id}
                  href={ROUTES.tv(t.slug)}
                  className="group rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm transition-colors hover:border-brand/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold group-hover:text-brand-accent">
                        {t.name}
                      </p>
                      {t.season ? (
                        <p className="text-xs font-medium text-muted-foreground">{t.season}</p>
                      ) : null}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        (t.draftPhase === "LIVE" || t.draftPhase === "PAUSED") &&
                          "border-brand/40 bg-brand/15 text-brand-accent",
                      )}
                    >
                      {DRAFT_PHASE_LABEL[t.draftPhase]}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>
                      {SPORT_META[t.sport].emoji} {SPORT_META[t.sport].label}
                    </span>
                    <span>{t._count.teams} teams</span>
                    <span>{t._count.players} players</span>
                    <span>{TOURNAMENT_FORMAT_LABEL[t.format]}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
