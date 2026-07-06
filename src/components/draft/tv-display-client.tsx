"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { AuctionTvBanner } from "@/components/draft/auction-tv-banner";
import { TvTeamRosterPanel } from "@/components/draft/tv-team-roster-panel";
import { DRAFT_PHASE_LABEL } from "@/constants/draft-phase-labels";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { DraftPhase } from "@/generated/prisma/enums";
import { useDraftLiveSync } from "@/hooks/use-draft-live-sync";
import { getDraftProgressDisplay } from "@/lib/draft/draft-progress";
import { cn } from "@/lib/utils";
import type { DraftPlayerDto, DraftSnapshotDto } from "@/types/draft";

interface TvDisplayClientProps {
  slug: string;
  initialSnapshot: DraftSnapshotDto;
}

/** Public hall / projector board: respects light & dark themes; franchises stack vertically. */
export function TvDisplayClient({ slug, initialSnapshot }: TvDisplayClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  useDraftLiveSync(slug, snapshot.tournamentId, setSnapshot, {
    enabled: true,
    accelerated:
      snapshot.draftPhase === DraftPhase.LIVE ||
      snapshot.draftPhase === DraftPhase.PAUSED,
  });

  const teamsById = useMemo(() => {
    const map: Record<string, DraftSnapshotDto["teams"][number]> = {};
    snapshot.teams.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [snapshot.teams]);

  const rosterCategoryRank = useMemo(() => {
    const map = new Map<string, number>();
    snapshot.squadRules.forEach((rule, index) => {
      map.set(rule.rosterCategoryId, index);
    });
    return map;
  }, [snapshot.squadRules]);

  const { confirmedByTeam, pendingByTeam } = useMemo(() => {
    const confirmedMap = new Map<string, DraftPlayerDto[]>();
    const pendingMap = new Map<string, DraftPlayerDto[]>();
    for (const player of snapshot.players) {
      const teamId = player.assignedTeamId;
      if (!teamId) continue;
      if (player.hasConfirmedPick) {
        const bucket = confirmedMap.get(teamId) ?? [];
        bucket.push(player);
        confirmedMap.set(teamId, bucket);
      } else {
        const bucket = pendingMap.get(teamId) ?? [];
        bucket.push(player);
        pendingMap.set(teamId, bucket);
      }
    }
    return { confirmedByTeam: confirmedMap, pendingByTeam: pendingMap };
  }, [snapshot.players]);

  const currentTurnTeamId = useMemo(() => {
    const slot = snapshot.draftSlots.find(
      (s) => s.slotIndex === snapshot.currentSlotIndex,
    );
    return slot?.teamId ?? null;
  }, [snapshot.currentSlotIndex, snapshot.draftSlots]);

  const activeTeam = currentTurnTeamId ? teamsById[currentTurnTeamId] : null;
  const live = snapshot.draftPhase === DraftPhase.LIVE;
  const completed = snapshot.draftPhase === DraftPhase.COMPLETED;
  const draftProgress = getDraftProgressDisplay(snapshot);

  const progressDenominator =
    snapshot.draftSlotsTotal > 0 ? snapshot.draftSlotsTotal : 1;

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-background text-foreground dark:bg-[#070b14] dark:text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,oklch(0.92_0.12_92/0.7),transparent_58%),radial-gradient(ellipse_80%_50%_at_98%_104%,oklch(0.95_0.06_96/0.6),transparent_55%)] opacity-95 dark:hidden"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,oklch(0.83_0.16_86/0.16),transparent_58%),radial-gradient(ellipse_80%_50%_at_95%_100%,oklch(0.8_0.13_82/0.07),transparent_55%)] dark:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-[size:clamp(40px,5vw,64px)_clamp(40px,5vw,64px)] opacity-[0.45] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] dark:opacity-[0.22]"
        aria-hidden
      />

      <header className="relative z-10 shrink-0 border-b border-border px-3 pb-8 pt-6 min-[400px]:px-4 sm:px-6 sm:pb-10 sm:pt-10 md:px-8 md:pb-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 md:max-w-[1920px] md:flex-row md:items-end md:justify-between md:gap-10 lg:gap-12">
          <div className="min-w-0 space-y-2 sm:space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent sm:text-[11px] sm:tracking-[0.28em]">
              {snapshot.allocationMethod === "LIVE_AUCTION"
                ? "Live Auction"
                : snapshot.allocationMethod === "RANDOM_ASSIGNMENT"
                  ? "Team Assignment"
                  : "Live Draft"}
            </p>
            <h1 className="text-balance text-[clamp(1.5rem,6vw,3.5rem)] font-bold leading-[1.08] tracking-tight md:text-[clamp(1.85rem,3.8vw,3.85rem)]">
              {snapshot.name}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[clamp(0.95rem,1.35vw,1.15rem)] dark:text-white/65">
              Live franchise rosters · current clock · drafted squads grouped by roster group.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:gap-4 md:max-w-md lg:max-w-lg">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge variant="secondary" className="border-border px-3 py-1.5 text-xs font-medium dark:border-white/20 dark:bg-white/10 dark:text-white">
                {DRAFT_PHASE_LABEL[snapshot.draftPhase]}
              </Badge>
              {live && snapshot.auctionSpotlightRosterCategoryId ? (
                <div className="flex flex-wrap items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 dark:border-brand/40 dark:bg-brand/15 sm:gap-3 sm:px-3 sm:py-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-brand-accent sm:text-[10px]">
                    Active round
                  </span>
                  <RosterCategoryPill
                    name={snapshot.auctionSpotlightRosterCategoryName ?? "Roster group"}
                    colorHex={snapshot.auctionSpotlightRosterCategoryColorHex}
                    className="border-border text-xs dark:border-white/20 dark:bg-black/30 dark:text-white"
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm backdrop-blur-sm sm:p-5 dark:border-white/12 dark:bg-black/40 dark:shadow-[0_0_80px_-40px_rgba(56,189,248,0.35)]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                {!completed ? (
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px] dark:text-white/50">
                      On the clock
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[clamp(1.1rem,4.5vw,1.95rem)] font-bold leading-tight md:text-[clamp(1.25rem,2.4vw,2rem)]",
                        live ? "text-foreground dark:text-white" : "text-muted-foreground dark:text-white/45",
                      )}
                    >
                      {activeTeam?.name ?? "—"}
                    </p>
                  </div>
                ) : null}
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px] dark:text-white/50">
                    Draft progress
                  </p>
                  <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg dark:text-white">
                    Pick {draftProgress.displayPickCount}/{progressDenominator}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums sm:text-xs dark:text-white/45">
                    Slot {draftProgress.currentPickOrdinal} of {snapshot.draftSlotsTotal || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 dark:from-sky-400 dark:to-emerald-400"
                  animate={{ width: `${draftProgress.progressPercent}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {snapshot.allocationMethod === "LIVE_AUCTION" && (
        <AuctionTvBanner snapshot={snapshot} />
      )}

      {snapshot.lastConfirmedPick && !completed ? (
        <section className="relative z-10 border-b border-emerald-200 bg-emerald-50/90 px-3 py-5 text-foreground sm:px-6 md:px-8 dark:border-emerald-500/20 dark:bg-emerald-950/35 dark:text-white">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:gap-4 md:max-w-[1920px] md:flex-row md:items-center md:gap-10 lg:gap-12">
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-800 sm:text-[11px] dark:text-emerald-200/95">
              Latest drafted pick
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={snapshot.lastConfirmedPick.playerName}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 md:gap-8"
              >
                <div className="min-w-0">
                  <p className="text-[clamp(1.2rem,5vw,2.1rem)] font-bold leading-snug tracking-tight md:text-[clamp(1.35rem,2.8vw,2.25rem)]">
                    {snapshot.lastConfirmedPick.playerName}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                    <RosterCategoryPill
                      name={snapshot.lastConfirmedPick.rosterCategoryName}
                      colorHex={snapshot.lastConfirmedPick.rosterCategoryColorHex}
                      className="text-sm dark:border-white/25 dark:bg-black/35"
                    />
                    <span className="text-sm text-muted-foreground sm:text-[clamp(0.95rem,1.35vw,1.1rem)] dark:text-white/80">
                      joins{" "}
                      <strong className="font-semibold text-foreground dark:text-white">
                        {snapshot.lastConfirmedPick.teamName}
                      </strong>
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      ) : null}

      <main className="relative z-10 flex-1 px-3 py-8 sm:px-6 sm:py-10 md:px-8 md:pb-14 md:pt-14">
        <div className="mx-auto mb-6 max-w-4xl sm:mb-8 md:max-w-[1920px]">
          <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg md:text-[clamp(1rem,1.5vw,1.25rem)] dark:text-white">
            Franchise boards
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-[clamp(0.88rem,1.15vw,1rem)] dark:text-white/55">
            Every team stacks below · confirmed rosters update live · pending nominees show an amber
            frame until the organizer confirms.
          </p>
        </div>

        {/* Single-column stack — best for readability on TV, projector, tablets, and phones */}
        <div className="mx-auto flex max-w-4xl flex-col gap-6 sm:gap-8 md:max-w-[1920px]">
          {snapshot.teams.map((team) => (
            <TvTeamRosterPanel
              key={team.id}
              team={team}
              confirmedPlayers={confirmedByTeam.get(team.id) ?? []}
              pendingPlayers={pendingByTeam.get(team.id) ?? []}
              rosterCategoryRank={rosterCategoryRank}
              isOnClock={currentTurnTeamId === team.id && live}
            />
          ))}
        </div>
      </main>

      <footer className="relative z-10 mt-auto border-t border-border px-3 py-4 text-center text-[10px] text-muted-foreground sm:px-6 sm:py-5 sm:text-xs md:px-8 dark:border-white/10 dark:text-white/45">
        Full screen suggested on hall displays (e.g. F11). This board auto-refreshes.
      </footer>
    </div>
  );
}
