import Link from "next/link";

import { ROUTES } from "@/constants/app";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { DraftPhase } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

interface AdminRosterGroupsBriefProps {
  tournamentSlug: string;
}

/**
 * Organizer-only panel on the auction control room highlighting roster-structure management.
 */
export async function AdminRosterGroupsBrief({ tournamentSlug }: AdminRosterGroupsBriefProps) {
  const tournament = await prisma.tournament.findFirst({
    where: { slug: tournamentSlug, deletedAt: null },
    select: { id: true, draftPhase: true },
  });
  if (!tournament) {
    return null;
  }

  const activeCategories = await prisma.rosterCategory.findMany({
    where: { tournamentId: tournament.id, archivedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, colorHex: true },
  });

  const archivedCount = await prisma.rosterCategory.count({
    where: {
      tournamentId: tournament.id,
      archivedAt: { not: null },
    },
  });

  const locked =
    tournament.draftPhase !== DraftPhase.SETUP && tournament.draftPhase !== DraftPhase.READY;

  return (
    <section className="rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm backdrop-blur-md sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Roster groups
          </h3>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Athlete badges, commissioner filters, squad limits, and the auction lobby all pull from
            these groups. Edit names, palette, ordering, and archives, no redeploy needed.
          </p>
          {archivedCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{archivedCount}</span>{" "}
              archived
              {archivedCount === 1 ? " group " : " groups "}
              (restore from setup when the draft stays in configuration mode).
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Link
            href={ROUTES.categories(tournamentSlug)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border/80 bg-background/80 px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted/70 sm:min-h-10"
          >
            {locked ? "View roster setup" : "Manage roster groups"}
          </Link>
          <Link
            href={ROUTES.rules(tournamentSlug)}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:text-sm"
          >
            Squad caps on Rules →
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-4">
        {activeCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground sm:text-sm">
            No active groups detected. Open Manage roster groups to scaffold your buckets.
          </p>
        ) : (
          activeCategories.map((c) => (
            <RosterCategoryPill key={c.id} name={c.name} colorHex={c.colorHex} />
          ))
        )}
      </div>
    </section>
  );
}
