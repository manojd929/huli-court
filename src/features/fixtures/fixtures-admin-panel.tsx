"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignTieMatchParticipantsAction,
  createFixtureTieAction,
  createSinglesMatchAction,
  createTieMatchAction,
  deleteFixtureMatchAction,
  deleteFixtureTieAction,
  generateRoundRobinTiesAction,
} from "@/features/fixtures/actions";
import { fixtureStatusLabel } from "@/features/tournament-run/match-presentation";
import { TournamentFormat } from "@/generated/prisma/enums";

interface FixturesAdminPanelProps {
  tournamentSlug: string;
  tournamentFormat: TournamentFormat;
  teams: Array<{ id: string; name: string }>;
  players: Array<{ id: string; name: string }>;
  doublesPlayersByTeam: Array<{
    teamId: string;
    players: Array<{ id: string; name: string }>;
  }>;
  ties: Array<{
    id: string;
    roundNumber: number | null;
    categoryLabel: string | null;
    teamOne: { id: string; name: string };
    teamTwo: { id: string; name: string };
  }>;
  matches: Array<{
    id: string;
    tieId: string | null;
    matchType: "SINGLES" | "DOUBLES";
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    sideOneScore: number | null;
    sideTwoScore: number | null;
    participants: Array<{
      id: string;
      side: "SIDE_ONE" | "SIDE_TWO";
      player: { id: string; name: string };
      team: { id: string; name: string } | null;
    }>;
  }>;
}

function hasLockedResult(match: FixturesAdminPanelProps["matches"][number]): boolean {
  return match.status === "COMPLETED" || match.sideOneScore !== null || match.sideTwoScore !== null;
}

function getSidePlayerIds(
  match: FixturesAdminPanelProps["matches"][number],
  side: "SIDE_ONE" | "SIDE_TWO",
): string[] {
  return match.participants
    .filter((participant) => participant.side === side)
    .map((participant) => participant.player.id);
}

function getMatchSideLabel(params: {
  match: FixturesAdminPanelProps["matches"][number];
  side: "SIDE_ONE" | "SIDE_TWO";
  fallbackTeamName?: string;
}): string {
  const names = params.match.participants
    .filter((participant) => participant.side === params.side)
    .map((participant) => participant.player.name.trim())
    .filter((name) => name.length > 0);

  if (names.length > 0) {
    return names.join(" + ");
  }
  if (params.fallbackTeamName) {
    return `${params.fallbackTeamName} pairing pending`;
  }
  return "Pairing pending";
}

export function FixturesAdminPanel({
  tournamentSlug,
  tournamentFormat,
  teams,
  players,
  doublesPlayersByTeam,
  ties,
  matches,
}: FixturesAdminPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const doublesPlayersMap = new Map(doublesPlayersByTeam.map((row) => [row.teamId, row.players]));
  const matchesByTie = new Map<string, FixturesAdminPanelProps["matches"]>();
  for (const tie of ties) {
    matchesByTie.set(
      tie.id,
      matches.filter((match) => match.tieId === tie.id),
    );
  }
  const standaloneMatches = matches.filter((match) => match.tieId === null);

  function refreshWithToast(
    run: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        toast.error(result.error ?? "Action failed.");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-sm backdrop-blur-sm">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-foreground">Schedule Builder</h3>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Admin only
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Generate the full schedule automatically or build ties manually. Once match results exist,
          destructive fixture changes are blocked to protect standings.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form
          className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            refreshWithToast(
              () =>
                generateRoundRobinTiesAction({
                  tournamentSlug,
                  matchesPerTie: Number(formData.get("matchesPerTie") ?? 5),
                  categoryLabel: String(formData.get("categoryLabel") ?? "").trim() || undefined,
                }),
              "Fixtures regenerated.",
            );
          }}
        >
          <div>
            <h4 className="font-medium text-foreground">Auto generate</h4>
            <p className="text-sm text-muted-foreground">
              Rebuild a doubles round robin for every team pairing. This is blocked after results
              are recorded.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="generate-matches-per-tie">Matches per tie</Label>
              <Input
                id="generate-matches-per-tie"
                name="matchesPerTie"
                type="number"
                min={1}
                max={15}
                defaultValue={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-category-label">Label</Label>
              <Input
                id="generate-category-label"
                name="categoryLabel"
                placeholder="Optional fixture label"
              />
            </div>
          </div>
          <Button type="submit" pending={pending} pendingLabel="Generating…">
            Generate fixtures
          </Button>
        </form>

        <form
          className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            refreshWithToast(
              () =>
                createFixtureTieAction({
                  tournamentSlug,
                  teamOneId: String(formData.get("teamOneId") ?? ""),
                  teamTwoId: String(formData.get("teamTwoId") ?? ""),
                  roundNumber:
                    String(formData.get("roundNumber") ?? "").trim() === ""
                      ? undefined
                      : Number(formData.get("roundNumber")),
                  matchesPerTie: Number(formData.get("matchesPerTie") ?? 1),
                  categoryLabel: String(formData.get("categoryLabel") ?? "").trim() || undefined,
                }),
              "Tie created.",
            );
          }}
        >
          <div>
            <h4 className="font-medium text-foreground">Build tie manually</h4>
            <p className="text-sm text-muted-foreground">
              Create a custom team-vs-team tie and seed its doubles matches.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-team-one">Team one</Label>
              <select
                id="manual-team-one"
                name="teamOneId"
                required
                defaultValue=""
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select team
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-team-two">Team two</Label>
              <select
                id="manual-team-two"
                name="teamTwoId"
                required
                defaultValue=""
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select team
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-round-number">Round number</Label>
              <Input
                id="manual-round-number"
                name="roundNumber"
                type="number"
                min={1}
                max={999}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-matches-per-tie">Matches</Label>
              <Input
                id="manual-matches-per-tie"
                name="matchesPerTie"
                type="number"
                min={1}
                max={15}
                defaultValue={1}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-category-label">Label</Label>
            <Input
              id="manual-category-label"
              name="categoryLabel"
              placeholder="Optional fixture label"
            />
          </div>
          <Button type="submit" pending={pending} pendingLabel="Creating tie…">
            Create tie
          </Button>
        </form>
      </div>

      {tournamentFormat !== TournamentFormat.DOUBLES_ONLY ? (
        <form
          className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            refreshWithToast(
              () =>
                createSinglesMatchAction({
                  tournamentSlug,
                  playerOneId: String(formData.get("playerOneId") ?? ""),
                  playerTwoId: String(formData.get("playerTwoId") ?? ""),
                  categoryLabel: String(formData.get("categoryLabel") ?? "").trim() || undefined,
                }),
              "Singles match created.",
            );
          }}
        >
          <div>
            <h4 className="font-medium text-foreground">Add standalone singles match</h4>
            <p className="text-sm text-muted-foreground">
              Use this when the tournament format includes singles fixtures outside a tie.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="singles-player-one">Player one</Label>
              <select
                id="singles-player-one"
                name="playerOneId"
                required
                defaultValue=""
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select player
                </option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="singles-player-two">Player two</Label>
              <select
                id="singles-player-two"
                name="playerTwoId"
                required
                defaultValue=""
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select player
                </option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="singles-category-label">Label</Label>
              <Input
                id="singles-category-label"
                name="categoryLabel"
                placeholder="Optional fixture label"
              />
            </div>
          </div>
          <Button type="submit" pending={pending} pendingLabel="Adding match…">
            Add singles match
          </Button>
        </form>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-medium text-foreground">Editable tie builder</h4>
            <p className="text-sm text-muted-foreground">
              Add matches, adjust doubles pairings, or remove future fixtures before results are
              locked in.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {ties.length} ties
          </Badge>
        </div>

        {ties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ties exist yet. Generate fixtures or create one manually.
          </p>
        ) : (
          <div className="space-y-4">
            {ties.map((tie) => {
              const tieMatches = matchesByTie.get(tie.id) ?? [];
              const sideOneOptions = doublesPlayersMap.get(tie.teamOne.id) ?? [];
              const sideTwoOptions = doublesPlayersMap.get(tie.teamTwo.id) ?? [];
              const tieLocked = tieMatches.some((match) => hasLockedResult(match));

              return (
                <article
                  key={tie.id}
                  className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h5 className="font-medium text-foreground">
                        {tie.teamOne.name} vs {tie.teamTwo.name}
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {tie.roundNumber ? `Round ${tie.roundNumber}` : "Custom tie"}
                        {tie.categoryLabel ? ` · ${tie.categoryLabel}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        pending={pending}
                        pendingLabel="Adding match…"
                        disabled={tieLocked}
                        onClick={() =>
                          refreshWithToast(
                            () => createTieMatchAction({ tournamentSlug, tieId: tie.id }),
                            "Match added to tie.",
                          )
                        }
                      >
                        Add match
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        pending={pending}
                        pendingLabel="Deleting tie…"
                        disabled={tieLocked}
                        onClick={() => {
                          if (!window.confirm("Delete this tie and all of its future matches?")) {
                            return;
                          }
                          refreshWithToast(
                            () => deleteFixtureTieAction({ tournamentSlug, tieId: tie.id }),
                            "Tie deleted.",
                          );
                        }}
                      >
                        Delete tie
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {tieMatches.map((match, index) => {
                      const sideOnePlayerIds = getSidePlayerIds(match, "SIDE_ONE");
                      const sideTwoPlayerIds = getSidePlayerIds(match, "SIDE_TWO");
                      const locked = hasLockedResult(match);

                      return (
                        <form
                          key={match.id}
                          className="space-y-3 rounded-2xl border border-border/50 bg-card/50 p-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const formData = new FormData(event.currentTarget);
                            const sideOneIds = [
                              String(formData.get("sideOnePlayerOneId") ?? "").trim(),
                              String(formData.get("sideOnePlayerTwoId") ?? "").trim(),
                            ].filter((value) => value.length > 0);
                            const sideTwoIds = [
                              String(formData.get("sideTwoPlayerOneId") ?? "").trim(),
                              String(formData.get("sideTwoPlayerTwoId") ?? "").trim(),
                            ].filter((value) => value.length > 0);
                            refreshWithToast(
                              () =>
                                assignTieMatchParticipantsAction({
                                  tournamentSlug,
                                  matchId: match.id,
                                  sideOnePlayerIds: sideOneIds,
                                  sideTwoPlayerIds: sideTwoIds,
                                }),
                              "Pairings updated.",
                            );
                          }}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">Match {index + 1}</p>
                                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                                  {fixtureStatusLabel(match.status)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {getMatchSideLabel({
                                  match,
                                  side: "SIDE_ONE",
                                  fallbackTeamName: tie.teamOne.name,
                                })}{" "}
                                vs{" "}
                                {getMatchSideLabel({
                                  match,
                                  side: "SIDE_TWO",
                                  fallbackTeamName: tie.teamTwo.name,
                                })}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              pending={pending}
                              pendingLabel="Deleting match…"
                              disabled={locked}
                              onClick={() => {
                                if (!window.confirm("Delete this future match?")) {
                                  return;
                                }
                                refreshWithToast(
                                  () =>
                                    deleteFixtureMatchAction({
                                      tournamentSlug,
                                      matchId: match.id,
                                    }),
                                  "Match deleted.",
                                );
                              }}
                            >
                              Delete match
                            </Button>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-foreground">
                                {tie.teamOne.name}
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`${match.id}-side-one-player-one`}>
                                    Player 1
                                  </Label>
                                  <select
                                    id={`${match.id}-side-one-player-one`}
                                    name="sideOnePlayerOneId"
                                    defaultValue={sideOnePlayerIds[0] ?? ""}
                                    disabled={locked}
                                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                                  >
                                    <option value="">Unassigned</option>
                                    {sideOneOptions.map((player) => (
                                      <option key={player.id} value={player.id}>
                                        {player.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`${match.id}-side-one-player-two`}>
                                    Player 2
                                  </Label>
                                  <select
                                    id={`${match.id}-side-one-player-two`}
                                    name="sideOnePlayerTwoId"
                                    defaultValue={sideOnePlayerIds[1] ?? ""}
                                    disabled={locked}
                                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                                  >
                                    <option value="">Unassigned</option>
                                    {sideOneOptions.map((player) => (
                                      <option key={player.id} value={player.id}>
                                        {player.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <p className="text-sm font-medium text-foreground">
                                {tie.teamTwo.name}
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`${match.id}-side-two-player-one`}>
                                    Player 1
                                  </Label>
                                  <select
                                    id={`${match.id}-side-two-player-one`}
                                    name="sideTwoPlayerOneId"
                                    defaultValue={sideTwoPlayerIds[0] ?? ""}
                                    disabled={locked}
                                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                                  >
                                    <option value="">Unassigned</option>
                                    {sideTwoOptions.map((player) => (
                                      <option key={player.id} value={player.id}>
                                        {player.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`${match.id}-side-two-player-two`}>
                                    Player 2
                                  </Label>
                                  <select
                                    id={`${match.id}-side-two-player-two`}
                                    name="sideTwoPlayerTwoId"
                                    defaultValue={sideTwoPlayerIds[1] ?? ""}
                                    disabled={locked}
                                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                                  >
                                    <option value="">Unassigned</option>
                                    {sideTwoOptions.map((player) => (
                                      <option key={player.id} value={player.id}>
                                        {player.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button
                            type="submit"
                            pending={pending}
                            pendingLabel="Saving pairings…"
                            disabled={locked}
                          >
                            Save pairings
                          </Button>
                        </form>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {standaloneMatches.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-foreground">Standalone matches</h4>
            <p className="text-sm text-muted-foreground">
              Singles or untied fixtures created outside the team-vs-team board.
            </p>
          </div>
          <div className="space-y-3">
            {standaloneMatches.map((match, index) => {
              const locked = hasLockedResult(match);

              return (
                <article
                  key={match.id}
                  className="rounded-2xl border border-border/60 bg-background/60 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">Match {index + 1}</p>
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                          {fixtureStatusLabel(match.status)}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                          {match.matchType}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getMatchSideLabel({ match, side: "SIDE_ONE" })} vs{" "}
                        {getMatchSideLabel({ match, side: "SIDE_TWO" })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      pending={pending}
                      pendingLabel="Deleting match…"
                      disabled={locked}
                      onClick={() => {
                        if (!window.confirm("Delete this future standalone match?")) {
                          return;
                        }
                        refreshWithToast(
                          () => deleteFixtureMatchAction({ tournamentSlug, matchId: match.id }),
                          "Standalone match deleted.",
                        );
                      }}
                    >
                      Delete match
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
