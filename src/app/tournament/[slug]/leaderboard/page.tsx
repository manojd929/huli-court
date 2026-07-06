import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { LeaderboardTable } from "@/features/tournament-run/leaderboard-table";
import {
  fixtureStatusLabel,
  getFixtureSideLabel,
} from "@/features/tournament-run/match-presentation";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { getTournamentRunSummary } from "@/services/tournament-run-service";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeaderboardPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/tournament/${slug}/leaderboard`);
  await requireTournamentViewAccess(slug, user.id);

  const summary = await getTournamentRunSummary(slug);
  if (!summary) notFound();
  const untiedMatches = summary.matches.filter((match) => match.tieId === null);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Knockout board</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Standings and full match results in one read-only view. Owners can use this board to track every tie, scoreline, and elimination state without entering the admin run workflow.
        </p>
      </header>

      <LeaderboardTable
        format={summary.tournament.format}
        standings={summary.standings}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium text-foreground">Match results by tie</h3>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {summary.ties.length} ties
          </Badge>
        </div>

        {summary.ties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ties generated yet.</p>
        ) : (
          <div className="space-y-4">
            {summary.ties.map((tie) => {
              const tieMatches = summary.matches.filter((match) => match.tieId === tie.id);

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
                          Round {tie.roundNumber} · {tieMatches.length} matches
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {tieMatches.filter((match) => match.status === "COMPLETED").length}/{tieMatches.length} completed
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
                                <span className="font-medium text-foreground">{tie.teamOne.name}:</span>{" "}
                                {getFixtureSideLabel({
                                  match,
                                  side: "SIDE_ONE",
                                  fallbackTeamName: tie.teamOne.name,
                                })}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">{tie.teamTwo.name}:</span>{" "}
                                {getFixtureSideLabel({
                                  match,
                                  side: "SIDE_TWO",
                                  fallbackTeamName: tie.teamTwo.name,
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-center">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              Score
                            </p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {match.sideOneScore !== null && match.sideTwoScore !== null
                                ? `${match.sideOneScore} - ${match.sideTwoScore}`
                                : "Awaiting result"}
                            </p>
                          </div>
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

                  <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Score
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {match.sideOneScore !== null && match.sideTwoScore !== null
                        ? `${match.sideOneScore} - ${match.sideTwoScore}`
                        : "Awaiting result"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
