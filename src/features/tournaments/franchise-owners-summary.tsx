import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteFranchiseOwnerLoginButton } from "@/features/tournaments/delete-franchise-owner-login-button";
import { formatAssignablePersonLabel } from "@/lib/format-assignable-person-label";
import type { AssignablePerson } from "@/types/assignable-person";

interface FranchiseOwnersSummaryProps {
  tournamentSlug: string;
  invitingSupported: boolean;
  canInviteOwners: boolean;
  assignablePeople: AssignablePerson[];
  teams: Array<{ id: string; name: string; ownerUserId: string | null }>;
}

export function FranchiseOwnersSummary({
  tournamentSlug,
  invitingSupported,
  canInviteOwners,
  assignablePeople,
  teams,
}: FranchiseOwnersSummaryProps) {
  const teamsByOwner = new Map<string, string[]>();
  for (const team of teams) {
    if (!team.ownerUserId) continue;
    const list = teamsByOwner.get(team.ownerUserId) ?? [];
    list.push(team.name);
    teamsByOwner.set(team.ownerUserId, list);
  }
  for (const [, names] of teamsByOwner) {
    names.sort((a, b) => a.localeCompare(b));
  }

  return (
    <section
      className="rounded-xl border border-border/70 bg-card/40 p-6 backdrop-blur-md"
      aria-labelledby="franchise-owners-summary-heading"
    >
      <h3 id="franchise-owners-summary-heading" className="text-lg font-semibold tracking-tight">
        Franchise owners (this league)
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Only franchise-owner accounts tied to this league appear below (role Owner or linked from a
        roster row here). Commissioner logins never appear. Removing login clears assignments here,
        drops roster links for those accounts in this league, and deletes sign-in credentials when
        nothing else references them.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border/60 bg-background/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Owner</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="w-[1%] text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignablePeople.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No eligible franchise owners yet. Prefer adding someone as a player first, grant a
                  login from Players, then assign them from Teams.
                </TableCell>
              </TableRow>
            ) : (
              assignablePeople.map((person) => {
                const franchiseNames = teamsByOwner.get(person.id);
                return (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      {formatAssignablePersonLabel(person)}
                    </TableCell>
                    <TableCell className="max-w-[min(28rem,65vw)] text-sm text-muted-foreground">
                      {franchiseNames?.length ? franchiseNames.join(", ") : "Not assigned yet"}
                    </TableCell>
                    <TableCell className="text-right align-middle">
                      <DeleteFranchiseOwnerLoginButton
                        tournamentSlug={tournamentSlug}
                        ownerUserId={person.id}
                        ownerLabel={formatAssignablePersonLabel(person)}
                        invitingSupported={invitingSupported}
                        canInviteOwners={canInviteOwners}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
