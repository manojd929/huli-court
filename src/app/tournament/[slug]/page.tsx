import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TOURNAMENT_FORMAT_LABEL } from "@/constants/tournament-format-labels";
import {
  PlayersCategoryDashboard,
  type PlayersCategoryDashboardRow,
} from "@/features/tournaments/players-category-dashboard";
import { TournamentBrandingForm } from "@/features/tournaments/tournament-branding-form";
import { getSessionUser } from "@/lib/auth/session";
import { formatMinorUnitsForDisplay } from "@/lib/currency/player-entry-fee";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { prisma } from "@/lib/prisma";
import { isLeagueImageUploadConfigured } from "@/lib/uploads/league-image-blob-env";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TournamentHubPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}`);
  }
  const tournament = await requireTournamentViewAccess(slug, user.id);
  const isCommissioner = user.id === tournament.createdById;
  const canEditBranding = isCommissioner;
  const uploadsEnabled = isLeagueImageUploadConfigured();
  const [playersCount, teamsCount, rosterGroups, groupedPlayers] = await Promise.all([
    prisma.player.count({
      where: { tournamentId: tournament.id, deletedAt: null },
    }),
    prisma.team.count({
      where: { tournamentId: tournament.id, deletedAt: null },
    }),
    prisma.rosterCategory.findMany({
      where: { tournamentId: tournament.id, archivedAt: null },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, colorHex: true },
    }),
    prisma.player.groupBy({
      by: ["rosterCategoryId"],
      where: { tournamentId: tournament.id, deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  const countsByCategory = new Map<string, number>();
  for (const row of groupedPlayers) {
    countsByCategory.set(row.rosterCategoryId, row._count._all);
  }
  const dashboardRows: PlayersCategoryDashboardRow[] = rosterGroups.map((category) => ({
    rosterCategoryId: category.id,
    name: category.name,
    colorHex: category.colorHex,
    count: countsByCategory.get(category.id) ?? 0,
  }));
  const tournamentSummaryItems = [
    {
      label: "Format",
      value: TOURNAMENT_FORMAT_LABEL[tournament.format],
    },
    {
      label: "Picks per team",
      value: String(tournament.picksPerTeam),
    },
    ...(tournament.playerEntryFeeMinorUnits !== null
      ? [
          {
            label: "Entry fee",
            value: formatMinorUnitsForDisplay(
              tournament.playerEntryFeeMinorUnits,
              tournament.playerEntryFeeCurrencyCode,
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {canEditBranding ? (
        <TournamentBrandingForm
          key={`${tournament.logoUrl ?? ""}-${tournament.colorHex ?? ""}-${tournament.name}`}
          tournamentSlug={slug}
          initialName={tournament.name}
          initialLogoUrl={tournament.logoUrl ?? null}
          initialColorHex={tournament.colorHex ?? null}
          uploadsEnabled={uploadsEnabled}
        />
      ) : null}

      <section className="rounded-xl border border-border/80 bg-card/35 p-4 backdrop-blur-md sm:p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tournamentSummaryItems.map((item) => (
              <Badge key={item.label} variant="secondary" className="px-3 py-1 text-xs font-medium">
                {item.label}: {item.value}
              </Badge>
            ))}
          </div>
          {tournament.description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {tournament.description}
            </p>
          ) : null}
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {isCommissioner ? (
              <>
                Set up rosters before go-live day. Drive the auction from{" "}
                <strong className="font-semibold text-foreground">Run the auction</strong>; put{" "}
                <strong className="font-semibold text-foreground">Live roster board</strong> up for
                the room.
              </>
            ) : (
              <>
                You can browse setup pages now. Franchise owners nominate from{" "}
                <strong className="font-semibold text-foreground">Run the auction</strong> flow, and
                can check confirmed picks in{" "}
                <strong className="font-semibold text-foreground">My Team</strong> when they are
                signed in. The commissioner works from Manage auction instead.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Players",
            value: playersCount,
            description: "Total roster pool in this tournament",
          },
          {
            label: "Teams",
            value: teamsCount,
            description: "Franchises currently configured",
          },
          {
            label: "Roster groups",
            value: rosterGroups.length,
            description: "Active roster buckets used across the auction",
          },
        ].map((item) => (
          <Card key={item.label} className="border-border/80 bg-card/40">
            <CardHeader className="gap-2">
              <CardDescription className="text-xs tracking-[0.16em] uppercase">
                {item.label}
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight">{item.value}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <PlayersCategoryDashboard rows={dashboardRows} totalPlayers={playersCount} />
    </div>
  );
}
