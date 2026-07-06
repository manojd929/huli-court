"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { DraftSnapshotDto } from "@/types/draft";

interface AuctionTvBannerProps {
  snapshot: DraftSnapshotDto;
}

/** Projector strip for LIVE_AUCTION tournaments: current lot + team purses. */
export function AuctionTvBanner({ snapshot }: AuctionTvBannerProps) {
  const auction = snapshot.auction;
  if (!auction) return null;

  const lot = auction.currentLot;
  const lotPlayer = lot
    ? snapshot.players.find((p) => p.id === lot.playerId) ?? null
    : null;
  const leadingTeam = lot?.currentBidTeamId
    ? snapshot.teams.find((t) => t.id === lot.currentBidTeamId) ?? null
    : null;
  const purseByTeamId = new Map(auction.purses.map((p) => [p.teamId, p]));

  return (
    <section className="relative z-10 border-b border-border px-3 py-4 min-[400px]:px-4 sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:max-w-[1920px] lg:flex-row lg:items-stretch lg:gap-6">
        <AnimatePresence mode="wait">
          {lot && lotPlayer ? (
            <motion.div
              key={lot.lotId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-1 items-center gap-4 rounded-xl border border-brand/50 bg-brand-soft/40 px-4 py-3 ring-1 ring-brand/20 sm:px-6 sm:py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent">
                  Under the hammer
                </p>
                <p className="truncate text-[clamp(1.25rem,3vw,2.25rem)] font-bold leading-tight">
                  {lotPlayer.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lotPlayer.rosterCategoryName} · base {lot.basePrice}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[clamp(1.75rem,4vw,3rem)] font-bold tabular-nums leading-none text-brand-accent">
                  {lot.currentBid ?? lot.basePrice}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {lot.currentBid !== null && leadingTeam
                    ? leadingTeam.name
                    : "no bids yet"}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground sm:px-6 sm:py-4"
            >
              Waiting for the next lot…
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:max-w-md">
          {snapshot.teams.map((team) => {
            const purse = purseByTeamId.get(team.id);
            const leading = lot?.currentBidTeamId === team.id;
            return (
              <div
                key={team.id}
                className={
                  leading
                    ? "rounded-lg border border-brand/60 bg-brand/15 px-3 py-1.5"
                    : "rounded-lg border border-border px-3 py-1.5"
                }
              >
                <p className="truncate text-xs font-medium">
                  {team.shortName ?? team.name}
                </p>
                <p className="text-sm font-bold tabular-nums">
                  {purse?.remaining ?? "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
