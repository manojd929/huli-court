import { redirect } from "next/navigation";
import Link from "next/link";

import { ROUTES } from "@/constants/app";
import type { RosterCategorySelectOption } from "@/features/tournaments/players-quick-add";
import {
  PlayersTableClient,
  type PlayersTableRow,
} from "@/features/tournaments/players-table-client";
import { PlayersSetupToolbar } from "@/features/tournaments/players-setup-toolbar";
import { DraftPhase } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { prisma } from "@/lib/prisma";
import { isLeagueImageUploadConfigured } from "@/lib/uploads/league-image-blob-env";
import { isLeagueOwnerInviteConfigured } from "@/services/league-account-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PlayersPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/players`);
  }

  const tournament = await requireTournamentViewAccess(slug, user.id);
  const isCommissioner = tournament.createdById === user.id;

  const uploadsEnabled = isLeagueImageUploadConfigured();
  const invitingSupported = isLeagueOwnerInviteConfigured();
  const canInviteOwners =
    tournament.draftPhase === DraftPhase.SETUP || tournament.draftPhase === DraftPhase.READY;

  const rosterCategories = await prisma.rosterCategory.findMany({
    where: { tournamentId: tournament.id, archivedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, colorHex: true },
  });

  const players = await prisma.player.findMany({
    where: { tournamentId: tournament.id, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      rosterCategory: {
        select: { id: true, name: true, colorHex: true },
      },
    },
  });

  const selectableCategories: RosterCategorySelectOption[] = rosterCategories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const defaultRosterCategoryId = selectableCategories[0]?.id ?? "";

  const playerRows: PlayersTableRow[] = players.map((player) => ({
    id: player.id,
    name: player.name,
    rosterCategoryId: player.rosterCategoryId,
    rosterCategoryName: player.rosterCategory.name,
    rosterCategoryColorHex: player.rosterCategory.colorHex,
    gender: player.gender,
    photoUrl: player.photoUrl,
    notes: player.notes,
    linkedOwnerUserId: player.linkedOwnerUserId,
    isUnavailable: player.isUnavailable,
    isLocked: player.isLocked,
    hasPaidEntryFee: player.hasPaidEntryFee,
    basePrice: player.basePrice,
  }));

  return (
    <div className="space-y-6 sm:space-y-10">
      <header>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Players</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Build the draft pool privately on this desk, then{" "}
          <Link
            href={ROUTES.categories(slug)}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            tune roster groups
          </Link>{" "}
          before syncing franchise owners from Teams.
        </p>
      </header>

      {isCommissioner ? (
        <PlayersSetupToolbar
          tournamentSlug={slug}
          uploadsEnabled={uploadsEnabled}
          selectableCategories={selectableCategories}
          defaultRosterCategoryId={defaultRosterCategoryId}
        />
      ) : null}

      <PlayersTableClient
        tournamentSlug={slug}
        players={playerRows}
        uploadsEnabled={uploadsEnabled}
        selectableCategories={selectableCategories}
        isCommissioner={isCommissioner}
        invitingSupported={invitingSupported}
        canInviteOwners={canInviteOwners}
        emptyState={
          selectableCategories.length === 0 ? (
            <>
              Configure{" "}
              <Link
                href={ROUTES.categories(slug)}
                className="font-medium underline-offset-4 hover:underline"
              >
                roster groups
              </Link>{" "}
              first, then open <span className="font-medium">Add player</span>.
            </>
          ) : (
            <>
              No players yet. Use <span className="font-medium">Add player</span> above.
            </>
          )
        }
      />
    </div>
  );
}
