import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  togglePlayerEliminationAction,
  toggleTeamEliminationAction,
  updateMatchStateAction,
} from "@/features/tournament-run/actions";
import {
  fixtureStatusLabel,
  getFixtureSideLabel,
} from "@/features/tournament-run/match-presentation";
import { ROUTES } from "@/constants/app";
import { TournamentFormat } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { getTournamentRunSummary } from "@/services/tournament-run-service";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RunTournamentPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/tournament/${slug}/run`);
  await requireTournamentViewAccess(slug, user.id);

  const summary = await getTournamentRunSummary(slug);
  if (!summary) notFound();

  const isAdmin = summary.tournament.createdById === user.id;
  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only tournament admin can manage live match operations.
      </p>
    );
  }
  const untiedMatches = summary.matches.filter((match) => match.tieId === null);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Run Tournament</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Enter final scores and the match is completed automatically. Use quick controls only for
          exceptions like starting a match early, resetting it, or cancelling it.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-2xl border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-foreground">Match operations</h3>
              <p className="text-sm text-muted-foreground">
                {summary.matches.filter((match) => match.status === "COMPLETED").length} of{" "}
                {summary.matches.length} matches completed
              </p>
            </div>
            <Link href={ROUTES.leaderboard(slug)}>
              <Button variant="outline" className="min-h-10 px-4">
                Open leaderboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-sm">
          <h3 className="font-medium text-foreground">Elimination controls</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark a {summary.tournament.format === TournamentFormat.DOUBLES_ONLY ? "team" : "player"}{" "}
            eliminated only if your format needs bracket-style knockouts.
          </p>
          <div className="mt-4 space-y-2">
            {summary.standings.map((row) => (
              <form
                key={row.entityId}
                action={async () => {
                  "use server";
                  if (summary.tournament.format === TournamentFormat.DOUBLES_ONLY) {
                    await toggleTeamEliminationAction({
                      tournamentSlug: slug,
                      entityId: row.entityId,
                      eliminated: !row.eliminated,
                    });
                    return;
                  }

                  await togglePlayerEliminationAction({
                    tournamentSlug: slug,
                    entityId: row.entityId,
                    eliminated: !row.eliminated,
                  });
                }}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/65 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.eliminated ? "Currently eliminated" : "Currently active"}
                  </p>
                </div>
                <PendingSubmitButton
                  size="sm"
                  variant={row.eliminated ? "outline" : "destructive"}
                  pendingLabel={row.eliminated ? "Reinstating…" : "Eliminating…"}
                >
                  {row.eliminated ? "Reinstate" : "Eliminate"}
                </PendingSubmitButton>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium text-foreground">Matches by tie</h3>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {summary.ties.length} ties
          </Badge>
        </div>

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
                      {tieMatches.filter((match) => match.status === "COMPLETED").length}/
                      {tieMatches.length} completed
                    </Badge>
                  </div>
                </div>

                <div className="divide-y divide-border/50">
                  {tieMatches.map((match, index) => (
                    <div key={match.id} className="px-5 py-4">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
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

                        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                          <form
                            action={async (formData) => {
                              "use server";
                              const sideOneScoreRaw = String(
                                formData.get("sideOneScore") ?? "",
                              ).trim();
                              const sideTwoScoreRaw = String(
                                formData.get("sideTwoScore") ?? "",
                              ).trim();
                              await updateMatchStateAction({
                                tournamentSlug: slug,
                                matchId: match.id,
                                sideOneScore:
                                  sideOneScoreRaw === "" ? null : Number(sideOneScoreRaw),
                                sideTwoScore:
                                  sideTwoScoreRaw === "" ? null : Number(sideTwoScoreRaw),
                              });
                            }}
                            className="grid gap-2 sm:grid-cols-2"
                          >
                            <Input
                              name="sideOneScore"
                              type="number"
                              min={0}
                              defaultValue={match.sideOneScore ?? ""}
                              placeholder={`${tie.teamOne.name} score`}
                            />
                            <Input
                              name="sideTwoScore"
                              type="number"
                              min={0}
                              defaultValue={match.sideTwoScore ?? ""}
                              placeholder={`${tie.teamTwo.name} score`}
                            />
                            <PendingSubmitButton
                              className="min-h-10 sm:col-span-2"
                              pendingLabel="Saving score…"
                            >
                              Submit final score
                            </PendingSubmitButton>
                          </form>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <form
                              action={async () => {
                                "use server";
                                await updateMatchStateAction({
                                  tournamentSlug: slug,
                                  matchId: match.id,
                                  status: "IN_PROGRESS",
                                });
                              }}
                            >
                              <PendingSubmitButton
                                variant="outline"
                                className="min-h-10 w-full"
                                pendingLabel="Starting…"
                              >
                                Start
                              </PendingSubmitButton>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await updateMatchStateAction({
                                  tournamentSlug: slug,
                                  matchId: match.id,
                                  status: "SCHEDULED",
                                });
                              }}
                            >
                              <PendingSubmitButton
                                variant="outline"
                                className="min-h-10 w-full"
                                pendingLabel="Resetting…"
                              >
                                Reset
                              </PendingSubmitButton>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await updateMatchStateAction({
                                  tournamentSlug: slug,
                                  matchId: match.id,
                                  status: "CANCELLED",
                                });
                              }}
                            >
                              <PendingSubmitButton
                                variant="outline"
                                className="min-h-10 w-full"
                                pendingLabel="Cancelling…"
                              >
                                Cancel
                              </PendingSubmitButton>
                            </form>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
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
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
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

                  <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                    <form
                      action={async (formData) => {
                        "use server";
                        const sideOneScoreRaw = String(formData.get("sideOneScore") ?? "").trim();
                        const sideTwoScoreRaw = String(formData.get("sideTwoScore") ?? "").trim();
                        await updateMatchStateAction({
                          tournamentSlug: slug,
                          matchId: match.id,
                          sideOneScore: sideOneScoreRaw === "" ? null : Number(sideOneScoreRaw),
                          sideTwoScore: sideTwoScoreRaw === "" ? null : Number(sideTwoScoreRaw),
                        });
                      }}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      <Input
                        name="sideOneScore"
                        type="number"
                        min={0}
                        defaultValue={match.sideOneScore ?? ""}
                        placeholder="Side 1 score"
                      />
                      <Input
                        name="sideTwoScore"
                        type="number"
                        min={0}
                        defaultValue={match.sideTwoScore ?? ""}
                        placeholder="Side 2 score"
                      />
                      <PendingSubmitButton
                        className="min-h-10 sm:col-span-2"
                        pendingLabel="Saving score…"
                      >
                        Submit final score
                      </PendingSubmitButton>
                    </form>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <form
                        action={async () => {
                          "use server";
                          await updateMatchStateAction({
                            tournamentSlug: slug,
                            matchId: match.id,
                            status: "IN_PROGRESS",
                          });
                        }}
                      >
                        <PendingSubmitButton
                          variant="outline"
                          className="min-h-10 w-full"
                          pendingLabel="Starting…"
                        >
                          Start
                        </PendingSubmitButton>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await updateMatchStateAction({
                            tournamentSlug: slug,
                            matchId: match.id,
                            status: "SCHEDULED",
                          });
                        }}
                      >
                        <PendingSubmitButton
                          variant="outline"
                          className="min-h-10 w-full"
                          pendingLabel="Resetting…"
                        >
                          Reset
                        </PendingSubmitButton>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await updateMatchStateAction({
                            tournamentSlug: slug,
                            matchId: match.id,
                            status: "CANCELLED",
                          });
                        }}
                      >
                        <PendingSubmitButton
                          variant="outline"
                          className="min-h-10 w-full"
                          pendingLabel="Cancelling…"
                        >
                          Cancel
                        </PendingSubmitButton>
                      </form>
                    </div>
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
