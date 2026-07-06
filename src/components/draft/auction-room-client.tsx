"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { placeAuctionBidAction } from "@/features/draft/actions";
import { useDraftLiveSync } from "@/hooks/use-draft-live-sync";
import { cn } from "@/lib/utils";
import type { DraftSnapshotDto } from "@/types/draft";

interface AuctionRoomClientProps {
  slug: string;
  initialSnapshot: DraftSnapshotDto;
  viewerUserId: string;
}

export function AuctionRoomClient({
  slug,
  initialSnapshot,
  viewerUserId,
}: AuctionRoomClientProps) {
  const [snapshot, setSnapshot] = useState<DraftSnapshotDto>(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [customBid, setCustomBid] = useState("");

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
  const myTeam = snapshot.teams.find((t) => t.ownerUserId === viewerUserId) ?? null;
  const myPurse = myTeam
    ? auction?.purses.find((p) => p.teamId === myTeam.id) ?? null
    : null;
  const leadingTeam = currentLot?.currentBidTeamId
    ? snapshot.teams.find((t) => t.id === currentLot.currentBidTeamId) ?? null
    : null;
  const iAmLeading = Boolean(myTeam && currentLot?.currentBidTeamId === myTeam.id);

  const minNextBid = currentLot
    ? currentLot.currentBid !== null
      ? currentLot.currentBid + (auction?.minIncrement ?? 0)
      : currentLot.basePrice
    : null;

  const myRoster = useMemo(
    () =>
      myTeam
        ? snapshot.players.filter((p) => p.assignedTeamId === myTeam.id)
        : [],
    [snapshot.players, myTeam],
  );

  const placeBid = useCallback(
    async (amount: number) => {
      if (!currentLot) return;
      setBusy(true);
      try {
        const result = await placeAuctionBidAction({
          tournamentSlug: slug,
          lotId: currentLot.lotId,
          amount,
          expectedBidCount: currentLot.bidCount,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Bid failed.");
        } else {
          toast.success(`Bid ${amount} placed!`);
          setCustomBid("");
        }
      } finally {
        setBusy(false);
        void refresh();
      }
    },
    [currentLot, refresh, slug],
  );

  if (!myTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spectating</CardTitle>
          <CardDescription>
            You are not a franchise owner in this tournament — enjoy the show on
            the live board.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isLive = snapshot.draftPhase === "LIVE";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{myTeam.name}</CardTitle>
            <CardDescription>Your franchise</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {myPurse?.remaining ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              purse left of {myPurse?.purse ?? "—"}
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className={cn(currentLot && "border-brand/60 bg-brand-soft/30 ring-1 ring-brand/20")}>
        <CardHeader>
          <CardTitle>
            {currentLot && lotPlayer
              ? `Under the hammer: ${lotPlayer.name}`
              : isLive
                ? "Waiting for the next lot…"
                : `Auction is ${snapshot.draftPhase.toLowerCase()}`}
          </CardTitle>
          {currentLot && lotPlayer && (
            <CardDescription>
              {lotPlayer.rosterCategoryName} · base {currentLot.basePrice}
            </CardDescription>
          )}
        </CardHeader>
        {currentLot && (
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold tabular-nums text-brand-accent">
                {currentLot.currentBid ?? currentLot.basePrice}
              </span>
              <span className="text-sm text-muted-foreground">
                {currentLot.currentBid !== null
                  ? iAmLeading
                    ? "you are leading!"
                    : `leading: ${leadingTeam?.name ?? "another team"}`
                  : "opening price — no bids yet"}
              </span>
            </div>

            {iAmLeading ? (
              <Badge className="border-brand/40 bg-brand/15 text-sm text-brand-accent" variant="secondary">
                Highest bidder — hold tight
              </Badge>
            ) : (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full bg-brand text-lg text-brand-foreground hover:bg-brand/90 focus-visible:ring-brand/50"
                  disabled={busy || !isLive || minNextBid === null}
                  onClick={() => minNextBid !== null && placeBid(minNextBid)}
                >
                  Bid {minNextBid}
                </Button>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={`Custom (min ${minNextBid})`}
                    value={customBid}
                    onChange={(event) => setCustomBid(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      !isLive ||
                      customBid.trim() === "" ||
                      Number.isNaN(Number(customBid))
                    }
                    onClick={() => placeBid(Number(customBid))}
                  >
                    Bid
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My squad ({myRoster.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {myRoster.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="truncate">
                  {player.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {player.rosterCategoryName}
                  </span>
                </span>
                {player.soldPrice !== null && (
                  <span className="text-sm font-medium tabular-nums">
                    {player.soldPrice}
                  </span>
                )}
              </li>
            ))}
            {myRoster.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">
                No players yet — win some lots!
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
