import { redirect } from "next/navigation";

import {
  PickLimitsGuidance,
  type PickLimitsCategoryFitRow,
} from "@/features/tournaments/pick-limits-guidance";
import { SquadRulesAutoFillButton } from "@/features/tournaments/squad-rules-auto-fill-button";
import { SquadRulesForm } from "@/features/tournaments/squad-rules-form";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import {
  rosterCategoryOrderIds,
} from "@/lib/squad-rules/compute-per-team-caps";
import { prisma } from "@/lib/prisma";
import type { SquadRuleDto } from "@/types/draft";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RulesPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/rules`);
  }

  const tournament = await requireTournamentViewAccess(slug, user.id);
  const isCommissioner = tournament.createdById === user.id;

  const [categories, squadRulesRaw, teamCount, groupedPlayers] = await Promise.all([
    prisma.rosterCategory.findMany({
      where: { tournamentId: tournament.id, archivedAt: null },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        displayOrder: true,
        colorHex: true,
      },
    }),
    prisma.squadRule.findMany({
      where: {
        tournamentId: tournament.id,
        rosterCategory: { archivedAt: null },
      },
      include: {
        rosterCategory: {
          select: { id: true, name: true, colorHex: true },
        },
      },
    }),
    prisma.team.count({
      where: { tournamentId: tournament.id, deletedAt: null },
    }),
    prisma.player.groupBy({
      by: ["rosterCategoryId"],
      where: {
        tournamentId: tournament.id,
        deletedAt: null,
      },
      _count: { _all: true },
    }),
  ]);

  const categoryOrder = rosterCategoryOrderIds(categories);

  const playersPerCategory: Partial<Record<string, number>> = {};
  for (const cid of categoryOrder) {
    playersPerCategory[cid] = 0;
  }
  for (const row of groupedPlayers) {
    playersPerCategory[row.rosterCategoryId] = row._count._all;
  }

  const categoryRows: PickLimitsCategoryFitRow[] = categoryOrder.map((rosterCategoryId) => {
    const meta = categories.find((c) => c.id === rosterCategoryId);
    const pool = playersPerCategory[rosterCategoryId] ?? 0;
    const fairCapPerTeam = teamCount > 0 ? Math.floor(pool / teamCount) : 0;
    const remainderAfterEvenSplit = pool - teamCount * fairCapPerTeam;
    return {
      rosterCategoryId,
      rosterCategoryName: meta?.name ?? "Roster group",
      rosterCategoryColorHex: meta?.colorHex ?? null,
      pool,
      fairCapPerTeam,
      remainderAfterEvenSplit,
    };
  });

  const totalPlayers = categoryOrder.reduce(
    (sum, rosterCategoryId) => sum + (playersPerCategory[rosterCategoryId] ?? 0),
    0,
  );

  const squadRuleMap = new Map(squadRulesRaw.map((rule) => [rule.rosterCategoryId, rule]));
  const initialRules: SquadRuleDto[] = categoryOrder.flatMap((rosterCategoryId) => {
    const rule = squadRuleMap.get(rosterCategoryId);
    const meta = categories.find((c) => c.id === rosterCategoryId);
    if (!rule || !meta) {
      return [];
    }
    return [
      {
        rosterCategoryId: rule.rosterCategoryId,
        rosterCategoryName: meta.name,
        rosterCategoryColorHex: meta.colorHex,
        maxCount: rule.maxCount,
      },
    ];
  });
  const formKey = initialRules
    .map((rule) => `${rule.rosterCategoryId}:${rule.maxCount}`)
    .join("|");

  return (
    <div className="space-y-6 sm:space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
            Pick limits
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Cap how many picks each franchise may spend on each roster group. If a group does not divide
            evenly across teams, an{" "}
            <strong className="font-semibold text-foreground">amber notice under that group</strong>{" "}
            lists how many players need recategorizing or how many to add. Use{" "}
            <strong className="font-semibold text-foreground">Auto-set limits from roster</strong> for ⌊pool ÷
            teams⌋ defaults.
          </p>
        </div>
        {isCommissioner ? <SquadRulesAutoFillButton tournamentSlug={slug} /> : null}
      </header>

      {isCommissioner ? (
        <SquadRulesForm
          key={formKey}
          tournamentSlug={slug}
          rosterSummary={{
            teamCount,
            playersPerCategory,
            categoryFitRows: categoryRows,
          }}
          initialRules={initialRules}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/40 p-4 backdrop-blur-md sm:p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roster group</TableHead>
                <TableHead className="text-right">Max picks per team</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRules.map((rule) => (
                <TableRow key={rule.rosterCategoryId}>
                  <TableCell>
                    <RosterCategoryPill
                      name={rule.rosterCategoryName}
                      colorHex={rule.rosterCategoryColorHex}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">{rule.maxCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PickLimitsGuidance
        teamCount={teamCount}
        picksPerTeam={tournament.picksPerTeam}
        totalPlayers={totalPlayers}
      />
    </div>
  );
}
