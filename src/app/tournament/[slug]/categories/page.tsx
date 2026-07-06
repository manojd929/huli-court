import { redirect } from "next/navigation";

import {
  RosterCategoriesAdmin,
  type RosterCategoryAdminRow,
} from "@/features/tournaments/roster-categories-admin";
import { DraftPhase } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TournamentCategoriesPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/categories`);
  }

  const tournament = await requireTournamentViewAccess(slug, user.id);
  const isCommissioner = tournament.createdById === user.id;

  const canManageCategories =
    isCommissioner &&
    (tournament.draftPhase === DraftPhase.SETUP || tournament.draftPhase === DraftPhase.READY);

  const rosterCategories = await prisma.rosterCategory.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      displayOrder: true,
      colorHex: true,
      archivedAt: true,
    },
  });

  const rows: RosterCategoryAdminRow[] = rosterCategories.map((row) => ({
    id: row.id,
    name: row.name,
    displayOrder: row.displayOrder,
    colorHex: row.colorHex,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6 sm:space-y-10">
      <header>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Roster groups</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Define tournament-specific categories — these drive player assignment, commissioner filters, squad
          rules, and pills on every auction surface. Customize labels, tint colors, and order before inviting
          players.
        </p>
      </header>

      <RosterCategoriesAdmin
        tournamentSlug={slug}
        canManageCategories={canManageCategories}
        categories={rows}
      />
    </div>
  );
}
