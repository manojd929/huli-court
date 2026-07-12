import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { FixturesAdminPanel } from "@/features/fixtures/fixtures-admin-panel";
import {
  fixtureStatusLabel,
  getFixtureSideLabel,
} from "@/features/tournament-run/match-presentation";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { getFixturesAdminOptions, getFixturesSummary } from "@/services/fixtures-service";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function FixturesPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/tournament/${slug}/fixtures`);
  await requireTournamentViewAccess(slug, user.id);

  const summary = await getFixturesSummary(slug);
  if (!summary) notFound();
  const { tournament, ties, matches, fixturesReady } = summary;

  if (tournament.draftPhase !== "COMPLETED") {
    return <p className="text-sm text-muted-foreground">Fixtures unlock after draft completion.</p>;
  }
  if (!fixturesReady) {
    return (
      <p className="text-sm text-muted-foreground">
        Fixtures are not initialized in this environment yet. Run <code>npm run db:migrate</code>{" "}
        and restart dev server.
      </p>
    );
  }

  const isAdmin = tournament.createdById === user.id;
  const untiedMatches = matches.filter((match) => match.tieId === null);
  const adminOptions = isAdmin ? await getFixturesAdminOptions(slug) : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Fixtures</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Team ties and scheduled matches live here. Admins can now auto-generate the schedule or
          build it manually, while viewers always see the same fixture board.
        </p>
      </header>

      {isAdmin && adminOptions ? (
        <FixturesAdminPanel
          tournamentSlug={slug}
          tournamentFormat={tournament.format}
          teams={adminOptions.teams}
          players={adminOptions.players}
          doublesPlayersByTeam={adminOptions.doublesPlayersByTeam}
          ties={ties.map((tie) => ({
            id: tie.id,
            roundNumber: tie.roundNumber,
            categoryLabel: tie.categoryLabel,
            teamOne: tie.teamOne,
            teamTwo: tie.teamTwo,
          }))}
          matches={matches.map((match) => ({
            id: match.id,
            tieId: match.tieId,
            matchType: match.matchType,
            status: match.status,
            sideOneScore: match.sideOneScore,
            sideTwoScore: match.sideTwoScore,
            participants: match.participants.map((participant) => ({
              id: participant.id,
              side: participant.side,
              player: participant.player,
              team: participant.team,
            })),
          }))}
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-foreground">Tie board</h3>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {ties.length} ties
          </Badge>
        </div>

        {ties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ties generated yet.</p>
        ) : (
          <div className="space-y-4">
            {ties.map((tie) => {
              const tieMatches = matches.filter((match) => match.tieId === tie.id);

              return (
                <article
                  key={tie.id}
                  className="overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-sm backdrop-blur-sm"
                >
                  <div className="border-b border-border/60 px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-foreground">
                          {tie.teamOne.name} vs {tie.teamTwo.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Round {tie.roundNumber} · {tieMatches.length} doubles matches
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {tieMatches.filter((match) => match.status === "COMPLETED").length}/
                        {tieMatches.length} completed
                      </Badge>
                    </div>
                  </div>

                  <div className="divide-y divide-border/50">
                    {tieMatches.map((match, index) => (
                      <div key={match.id} className="px-5 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">Match {index + 1}</p>
                              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                                {fixtureStatusLabel(match.status)}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">
                                  {tie.teamOne.name}:
                                </span>{" "}
                                {getFixtureSideLabel({
                                  match,
                                  side: "SIDE_ONE",
                                  fallbackTeamName: tie.teamOne.name,
                                })}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">
                                  {tie.teamTwo.name}:
                                </span>{" "}
                                {getFixtureSideLabel({
                                  match,
                                  side: "SIDE_TWO",
                                  fallbackTeamName: tie.teamTwo.name,
                                })}
                              </p>
                            </div>
                          </div>

                          {match.sideOneScore !== null && match.sideTwoScore !== null ? (
                            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-center">
                              <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                                Score
                              </p>
                              <p className="mt-1 text-lg font-semibold text-foreground">
                                {match.sideOneScore} - {match.sideTwoScore}
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
                              Awaiting score
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {untiedMatches.length > 0 ? (
        <section className="space-y-4">
          <h3 className="font-medium text-foreground">Standalone matches</h3>
          <div className="space-y-3">
            {untiedMatches.map((match, index) => (
              <article
                key={match.id}
                className="rounded-2xl border border-border/70 bg-card/40 px-5 py-4 shadow-sm backdrop-blur-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">Match {index + 1}</p>
                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                        {fixtureStatusLabel(match.status)}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{getFixtureSideLabel({ match, side: "SIDE_ONE" })}</p>
                      <p>{getFixtureSideLabel({ match, side: "SIDE_TWO" })}</p>
                    </div>
                  </div>

                  {match.sideOneScore !== null && match.sideTwoScore !== null ? (
                    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-center">
                      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                        Score
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {match.sideOneScore} - {match.sideTwoScore}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
                      Awaiting score
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
