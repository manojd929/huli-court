"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  closeAuctionLotAction,
  endDraftAction,
  openAuctionLotAction,
  pauseDraftAction,
  resumeDraftAction,
  startDraftAction,
} from "@/features/draft/actions";
import { useDraftLiveSync } from "@/hooks/use-draft-live-sync";
import { cn } from "@/lib/utils";
import type { DraftSnapshotDto } from "@/types/draft";

interface AuctionDeskClientProps {
  slug: string;
  initialSnapshot: DraftSnapshotDto;
}

export function AuctionDeskClient({ slug, initialSnapshot }: AuctionDeskClientProps) {
  const [snapshot, setSnapshot] = useState<DraftSnapshotDto>(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [poolQuery, setPoolQuery] = useState("");

  const accelerated =
    snapshot.draftPhase === "LIVE" || snapshot.draftPhase === "PAUSED";
  const { refresh } = useDraftLiveSync(slug, snapshot.tournamentId, setSnapshot, {
    accelerated,
  });

  const auction = snapshot.auction;
  const currentLot = auction?.currentLot ?? null;
  const lotPlayer = currentLot
    ? snapshot.players.find((p) => p.id === currentLot.playerId) ?? null
    : null;
  const leadingTeam = currentLot?.currentBidTeamId
    ? snapshot.teams.find((t) => t.id === currentLot.currentBidTeamId) ?? null
    : null;

  const unsoldIds = useMemo(
    () => new Set(auction?.unsoldPlayerIds ?? []),
    [auction?.unsoldPlayerIds],
  );

  const availablePlayers = useMemo(() => {
    const query = poolQuery.trim().toLowerCase();
    return snapshot.players
      .filter(
        (player) =>
          player.assignedTeamId === null &&
          !player.runsFranchiseLogin &&
          !player.isUnavailable &&
          !player.isLocked,
      )
      .filter(
        (player) => query === "" || player.name.toLowerCase().includes(query),
      );
  }, [snapshot.players, poolQuery]);

  const runAction = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>, successMessage?: string) => {
      setBusy(true);
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong.");
        } else if (successMessage) {
          toast.success(successMessage);
        }
      } finally {
        setBusy(false);
        void refresh();
      }
    },
    [refresh],
  );

  const isLive = snapshot.draftPhase === "LIVE";
  const purseByTeamId = new Map(
    (auction?.purses ?? []).map((p) => [p.teamId, p]),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Auction controls</CardTitle>
              <CardDescription>
                Phase: <Badge variant="outline">{snapshot.draftPhase}</Badge>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(snapshot.draftPhase === "SETUP" ||
                snapshot.draftPhase === "READY") && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => startDraftAction({ tournamentSlug: slug }),
                      "Auction is live!",
                    )
                  }
                >
                  Start auction
                </Button>
              )}
              {isLive && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    runAction(() => pauseDraftAction({ tournamentSlug: slug }))
                  }
                >
                  Pause
                </Button>
              )}
              {snapshot.draftPhase === "PAUSED" && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    runAction(() => resumeDraftAction({ tournamentSlug: slug }))
                  }
                >
                  Resume
                </Button>
              )}
              {(isLive || snapshot.draftPhase === "PAUSED") && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={(props) => (
                      <Button {...props} variant="destructive" disabled={busy}>
                        End auction
                      </Button>
                    )}
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>End the auction?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Unsold players stay unassigned. This completes the
                        allocation phase and unlocks fixtures.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep going</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          runAction(
                            () => endDraftAction({ tournamentSlug: slug }),
                            "Auction completed.",
                          )
                        }
                      >
                        End auction
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardHeader>
        </Card>

        <Card className={cn(currentLot && "border-brand/60 bg-brand-soft/30 ring-1 ring-brand/20")}>
          <CardHeader>
            <CardTitle>
              {currentLot && lotPlayer
                ? `Under the hammer: ${lotPlayer.name}`
                : "No lot open"}
            </CardTitle>
            <CardDescription>
              {currentLot && lotPlayer
                ? `${lotPlayer.rosterCategoryName} · base price ${currentLot.basePrice}`
                : isLive
                  ? "Pick a player from the pool to open the next lot."
                  : "Start the auction to open lots."}
            </CardDescription>
          </CardHeader>
          {currentLot && (
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold tabular-nums text-brand-accent">
                  {currentLot.currentBid ?? currentLot.basePrice}
                </span>
                <span className="text-sm text-muted-foreground">
                  {currentLot.currentBid !== null && leadingTeam
                    ? `leading bid by ${leadingTeam.name}`
                    : "no bids yet — base price"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || currentLot.currentBid === null}
                  className="bg-brand text-brand-foreground hover:bg-brand/90 focus-visible:ring-brand/50"
                  onClick={() =>
                    runAction(
                      () =>
                        closeAuctionLotAction({
                          tournamentSlug: slug,
                          lotId: currentLot.lotId,
                          outcome: "SOLD",
                        }),
                      lotPlayer && leadingTeam
                        ? `SOLD! ${lotPlayer.name} → ${leadingTeam.name}`
                        : "Sold.",
                    )
                  }
                >
                  Sold{leadingTeam ? ` to ${leadingTeam.name}` : ""}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () =>
                        closeAuctionLotAction({
                          tournamentSlug: slug,
                          lotId: currentLot.lotId,
                          outcome: "UNSOLD",
                        }),
                      "Marked unsold — back in the pool.",
                    )
                  }
                >
                  Unsold
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    runAction(() =>
                      closeAuctionLotAction({
                        tournamentSlug: slug,
                        lotId: currentLot.lotId,
                        outcome: "CANCELLED",
                      }),
                    )
                  }
                >
                  Cancel lot
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Player pool</CardTitle>
            <CardDescription>
              {availablePlayers.length} available · open a lot to start bidding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search players…"
              value={poolQuery}
              onChange={(event) => setPoolQuery(event.target.value)}
            />
            <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
              {availablePlayers.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {player.rosterCategoryName}
                      {unsoldIds.has(player.id) && (
                        <Badge variant="secondary" className="ml-2">
                          unsold earlier
                        </Badge>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !isLive || currentLot !== null}
                    onClick={() =>
                      runAction(
                        () =>
                          openAuctionLotAction({
                            tournamentSlug: slug,
                            playerId: player.id,
                          }),
                        `${player.name} is under the hammer.`,
                      )
                    }
                  >
                    Open lot
                  </Button>
                </li>
              ))}
              {availablePlayers.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No available players match.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Team purses</CardTitle>
            <CardDescription>
              Increment {auction?.minIncrement ?? "—"} · default base{" "}
              {auction?.defaultBasePrice ?? "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {snapshot.teams.map((team) => {
                const purse = purseByTeamId.get(team.id);
                const isLeading = currentLot?.currentBidTeamId === team.id;
                return (
                  <li
                    key={team.id}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2",
                      isLeading && "border-brand/60 bg-brand/10",
                    )}
                  >
                    <span className="truncate font-medium">
                      {team.name}
                      {isLeading && (
                        <Badge className="ml-2 border-brand/40 bg-brand/15 text-brand-accent" variant="secondary">
                          leading
                        </Badge>
                      )}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {purse ? (
                        <>
                          <span className="font-semibold text-foreground">
                            {purse.remaining}
                          </span>{" "}
                          / {purse.purse}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
