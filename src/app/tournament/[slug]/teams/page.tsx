import { redirect } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FranchiseOwnersSummary } from "@/features/tournaments/franchise-owners-summary";
import { RemoveTeamOwnerButton } from "@/features/tournaments/remove-team-owner-button";
import { TeamEditDialog } from "@/features/tournaments/team-edit-dialog";
import { TeamOwnerEditDialog } from "@/features/tournaments/team-owner-edit-dialog";
import { TeamsSetupToolbar } from "@/features/tournaments/teams-setup-toolbar";
import { DraftPhase } from "@/generated/prisma/enums";
import { buildFranchiseOwnerAssigneeList } from "@/lib/data/franchise-owner-assignees";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { prisma } from "@/lib/prisma";
import { isLeagueImageUploadConfigured } from "@/lib/uploads/league-image-blob-env";
import { isLeagueOwnerInviteConfigured } from "@/services/league-account-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TeamsPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/teams`);
  }

  const tournament = await requireTournamentViewAccess(slug, user.id);
  const isCommissioner = tournament.createdById === user.id;

  const invitingSupported = isLeagueOwnerInviteConfigured();
  const uploadsEnabled = isLeagueImageUploadConfigured();

  const teams = await prisma.team.findMany({
    where: { tournamentId: tournament.id, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      owner: { select: { email: true, displayName: true } },
    },
  });

  const existingTeamOwnerIds = teams
    .map((team) => team.ownerUserId)
    .filter((id): id is string => Boolean(id));

  const assignablePeople = await buildFranchiseOwnerAssigneeList({
    tournamentId: tournament.id,
    commissionerUserId: tournament.createdById,
    existingTeamOwnerIds,
  });

  const canInviteOwners =
    tournament.draftPhase === DraftPhase.SETUP || tournament.draftPhase === DraftPhase.READY;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Teams</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Franchise labels, visuals, and owner assignment. Capture new franchises from{" "}
          <span className="font-medium text-foreground">Add franchise</span> so this page stays
          tidy.
        </p>
      </header>

      {isCommissioner ? (
        <TeamsSetupToolbar
          tournamentSlug={slug}
          invitingSupported={invitingSupported}
          canInviteOwners={canInviteOwners}
          assignablePeople={assignablePeople}
          uploadsEnabled={uploadsEnabled}
        />
      ) : null}

      {isCommissioner ? (
        <FranchiseOwnersSummary
          tournamentSlug={slug}
          invitingSupported={invitingSupported}
          canInviteOwners={canInviteOwners}
          assignablePeople={assignablePeople}
          teams={teams.map((team) => ({
            id: team.id,
            name: team.name,
            ownerUserId: team.ownerUserId,
          }))}
        />
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/30 backdrop-blur-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Short name</TableHead>
              <TableHead>Owner</TableHead>
              {isCommissioner ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isCommissioner ? 4 : 3} className="text-muted-foreground">
                  No franchises yet. Open <span className="font-medium">Add franchise</span> above.
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="align-middle font-medium">{team.name}</TableCell>
                  <TableCell className="align-middle">{team.shortName ?? "-"}</TableCell>
                  <TableCell className="align-middle">
                    <div className="flex max-w-[min(26rem,92vw)] min-w-0 flex-col gap-2 lg:max-w-none lg:flex-row lg:items-center lg:gap-3">
                      <span className="min-w-0 flex-1 text-sm leading-snug break-words">
                        {team.owner ? (team.owner.displayName ?? team.owner.email) : "-"}
                      </span>
                      {isCommissioner ? (
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <TeamOwnerEditDialog
                            tournamentSlug={slug}
                            assignablePeople={assignablePeople}
                            team={{
                              id: team.id,
                              name: team.name,
                              shortName: team.shortName,
                              logoUrl: team.logoUrl,
                              colorHex: team.colorHex,
                              ownerUserId: team.ownerUserId,
                            }}
                          />
                          <RemoveTeamOwnerButton
                            tournamentSlug={slug}
                            team={{
                              id: team.id,
                              name: team.name,
                              shortName: team.shortName,
                              logoUrl: team.logoUrl,
                              colorHex: team.colorHex,
                              ownerUserId: team.ownerUserId,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  {isCommissioner ? (
                    <TableCell className="text-right align-middle">
                      <div className="flex justify-end">
                        <TeamEditDialog
                          tournamentSlug={slug}
                          uploadsEnabled={uploadsEnabled}
                          team={{
                            id: team.id,
                            name: team.name,
                            shortName: team.shortName,
                            logoUrl: team.logoUrl,
                            colorHex: team.colorHex,
                            ownerUserId: team.ownerUserId,
                          }}
                        />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
