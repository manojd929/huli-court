"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ShieldBanIcon, SparklesIcon, ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";

import { AuctionPendingReviewSheet } from "@/components/draft/auction-pending-review-sheet";
import { DraftRoomClient } from "@/components/draft/draft-room-client";
import { RandomDraftOrderShuffle } from "@/components/draft/random-draft-order-shuffle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  confirmPickAction,
  endDraftAction,
  freezeDraftAction,
  forceSyncAction,
  lockDraftAction,
  nextTurnAction,
  pauseDraftAction,
  previousTurnAction,
  resumeDraftAction,
  setAuctionSpotlightCategoryAction,
  skipTurnAction,
  startDraftAction,
  toggleOverrideValidationAction,
  undoPickAction,
  unlockDraftAction,
} from "@/features/draft/actions";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { DraftPhase } from "@/generated/prisma/enums";
import { useDraftLiveSync } from "@/hooks/use-draft-live-sync";
import { getDraftProgressDisplay } from "@/lib/draft/draft-progress";
import { cn } from "@/lib/utils";
import type { DraftSnapshotDto } from "@/types/draft";

interface AdminControlRoomClientProps {
  slug: string;
  initialSnapshot: DraftSnapshotDto;
  viewerUserId: string | null;
}

export function AdminControlRoomClient({
  slug,
  initialSnapshot,
  viewerUserId,
}: AdminControlRoomClientProps) {
  const [liveSnapshot, setLiveSnapshot] = useState(initialSnapshot);
  const [overrideWarnOpen, setOverrideWarnOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  useDraftLiveSync(slug, liveSnapshot.tournamentId, setLiveSnapshot, {
    enabled: true,
    accelerated:
      liveSnapshot.draftPhase === DraftPhase.LIVE || liveSnapshot.draftPhase === DraftPhase.PAUSED,
  });

  const slugRef = useRef(slug);
  const snapshotRef = useRef(liveSnapshot);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    snapshotRef.current = liveSnapshot;
  }, [liveSnapshot]);

  const fire = useCallback(
    async (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? `${label} failed`);
        return;
      }
      toast.success(label);
    },
    [],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const currentSlug = slugRef.current;
      const phase = snapshotRef.current.draftPhase;

      if (event.code === "Space") {
        event.preventDefault();
        void fire(phase === DraftPhase.LIVE ? "Paused" : "Live again", () =>
          phase === DraftPhase.LIVE
            ? pauseDraftAction({ tournamentSlug: currentSlug })
            : resumeDraftAction({ tournamentSlug: currentSlug }),
        );
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void fire("Pick saved", () => confirmPickAction({ tournamentSlug: currentSlug }));
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        void fire("Pick undone", () => undoPickAction({ tournamentSlug: currentSlug }));
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        void fire("Next team", () => nextTurnAction({ tournamentSlug: currentSlug }));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fire]);

  const shortcuts = useMemo(
    () => [
      { keys: "Space", label: "Pause or resume LIVE auction" },
      { keys: "Enter", label: "Confirm the pending nominee" },
      { keys: "Backspace", label: "Decline pending nominee or unwind last confirmation" },
      { keys: "N", label: "Advance turn (advanced)" },
    ],
    [],
  );

  const confirmEnableRulesOverride = useCallback(async () => {
    const result = await toggleOverrideValidationAction({
      tournamentSlug: slug,
      enabled: true,
    });
    if (!result.ok) {
      toast.error(result.error ?? "Could not turn on rules override.");
      return;
    }
    toast.success("Rules override on");
    setOverrideWarnOpen(false);
  }, [slug]);

  const s = slug;
  const live = liveSnapshot.draftPhase === DraftPhase.LIVE;
  const paused = liveSnapshot.draftPhase === DraftPhase.PAUSED;
  const draftProgress = getDraftProgressDisplay(liveSnapshot);
  const setupOrReady =
    liveSnapshot.draftPhase === DraftPhase.SETUP || liveSnapshot.draftPhase === DraftPhase.READY;

  const hasDraftSlots = liveSnapshot.draftSlotsTotal > 0;

  const canShuffleDraftOrder =
    setupOrReady && !liveSnapshot.draftOrderLocked && liveSnapshot.teams.length > 0;

  const shuffleUnavailableReason = useMemo(() => {
    if (liveSnapshot.teams.length === 0) {
      return "";
    }
    if (!setupOrReady) {
      return "Pick order is frozen once the auction begins. Shuffle only works in setup or ready, before Start auction.";
    }
    if (liveSnapshot.draftOrderLocked) {
      return "Pick order is locked for this tournament.";
    }
    return "";
  }, [liveSnapshot.draftOrderLocked, liveSnapshot.teams.length, setupOrReady]);

  const canStartAuction = setupOrReady && hasDraftSlots;

  const startAuctionDisabledReason = useMemo(() => {
    if (!setupOrReady) {
      if (liveSnapshot.draftPhase === DraftPhase.COMPLETED) {
        return "This auction is finished.";
      }
      return "The auction already started. Pause or use Advanced if you need operational changes.";
    }
    if (!hasDraftSlots) {
      return "Shuffle pick order first; that creates the round-by-round draft slots.";
    }
    return "";
  }, [hasDraftSlots, liveSnapshot.draftPhase, setupOrReady]);

  const showClockTeam =
    live ||
    paused ||
    liveSnapshot.draftPhase === DraftPhase.FROZEN ||
    liveSnapshot.draftPhase === DraftPhase.LOCKED;

  const phaseLabel = useMemo(() => {
    switch (liveSnapshot.draftPhase) {
      case DraftPhase.SETUP:
        return "Draft setup";
      case DraftPhase.READY:
        return "Ready";
      case DraftPhase.LIVE:
        return "Live";
      case DraftPhase.PAUSED:
        return "Paused";
      case DraftPhase.FROZEN:
        return "Screens frozen";
      case DraftPhase.LOCKED:
        return "Nominations locked";
      case DraftPhase.COMPLETED:
        return "Auction complete";
      default:
        return "—";
    }
  }, [liveSnapshot.draftPhase]);

  const currentTurnTeamId = useMemo(() => {
    const slot = liveSnapshot.draftSlots.find(
      (row) => row.slotIndex === liveSnapshot.currentSlotIndex,
    );
    return slot?.teamId ?? null;
  }, [liveSnapshot.currentSlotIndex, liveSnapshot.draftSlots]);

  const currentTeam =
    currentTurnTeamId !== null
      ? (liveSnapshot.teams.find((t) => t.id === currentTurnTeamId) ?? null)
      : null;
  const firstRoundTeamIds = useMemo(() => {
    const uniqueTeamCount = new Set(liveSnapshot.teams.map((team) => team.id)).size;
    if (uniqueTeamCount === 0 || liveSnapshot.draftSlots.length === 0) return [];
    return [...liveSnapshot.draftSlots]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .slice(0, uniqueTeamCount)
      .map((slot) => slot.teamId);
  }, [liveSnapshot.draftSlots, liveSnapshot.teams]);

  const spotlightSelectValue = liveSnapshot.auctionSpotlightRosterCategoryId ?? "OPEN";

  const spotlightTriggerLabel = useMemo(() => {
    if (spotlightSelectValue === "OPEN") {
      return "Everyone · all roster categories";
    }
    const fromRule = liveSnapshot.squadRules.find(
      (r) => r.rosterCategoryId === spotlightSelectValue,
    );
    if (fromRule) {
      return fromRule.rosterCategoryName;
    }
    if (
      liveSnapshot.auctionSpotlightRosterCategoryId === spotlightSelectValue &&
      liveSnapshot.auctionSpotlightRosterCategoryName
    ) {
      return liveSnapshot.auctionSpotlightRosterCategoryName;
    }
    return "Roster category";
  }, [
    liveSnapshot.auctionSpotlightRosterCategoryId,
    liveSnapshot.auctionSpotlightRosterCategoryName,
    liveSnapshot.squadRules,
    spotlightSelectValue,
  ]);

  return (
    <>
      <AuctionPendingReviewSheet slug={slug} snapshot={liveSnapshot} />

      <AlertDialog open={overrideWarnOpen} onOpenChange={setOverrideWarnOpen}>
        <AlertDialogContent className="sm:max-w-md" size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Turn on rules override?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              <span className="mb-3 block">
                Only use this for exceptions (wrong clock, bad quota setting, league allowance).
                Normal picks should leave rules on.
              </span>
              <span className="block font-medium text-foreground">What changes</span>
              <span className="mt-2 block text-muted-foreground">
                Squad category limits will not block nominations or confirmations. You may confirm a
                pending pick even when it does not match the team on the clock. Usual checks still
                apply: the player exists in this tournament, is available, and is not already
                drafted.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              onClick={() => void confirmEnableRulesOverride()}
            >
              Turn on override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen}>
        <AlertDialogContent className="sm:max-w-md" size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Keyboard shortcuts</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Optional accelerator keys for commissioners who prefer the keyboard during a live
              auction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="mx-1 list-none space-y-3 p-1 text-sm leading-snug sm:mx-3">
            {shortcuts.map((item) => (
              <li
                key={item.keys}
                className="flex items-center justify-between gap-4 text-foreground"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <kbd className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                  {item.keys}
                </kbd>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        <section
          className={cn("rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5")}
          aria-labelledby="admin-auction-heading"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span id="admin-auction-heading" className="sr-only">
                  Manage auction
                </span>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Manage auction
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border/90 font-normal tabular-nums">
                  {phaseLabel}
                </Badge>
                <Badge variant="secondary" className="font-normal">
                  Pick {draftProgress.displayPickCount} {" / "}
                  {liveSnapshot.draftSlotsTotal || "—"}
                </Badge>
                {liveSnapshot.overrideValidation ? (
                  <Badge
                    variant="destructive"
                    className="flex items-center gap-1 px-2 py-0.5 font-normal"
                  >
                    <ShieldBanIcon className="size-3 opacity-90" aria-hidden />
                    Roster rules relaxed
                  </Badge>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Franchise on the clock
                </p>
                <p className="mt-0.5 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                  {showClockTeam ? (currentTeam?.name ?? "—") : "—"}
                </p>
                {showClockTeam && currentTeam?.shortName ? (
                  <p className="text-xs text-muted-foreground">{currentTeam.shortName}</p>
                ) : null}
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {liveSnapshot.draftPhase === DraftPhase.COMPLETED
                  ? "This auction finished. Rosters reflect the confirmations you finalized."
                  : liveSnapshot.pendingPickPlayerId &&
                      (liveSnapshot.draftPhase === DraftPhase.LIVE ||
                        liveSnapshot.draftPhase === DraftPhase.FROZEN ||
                        liveSnapshot.draftPhase === DraftPhase.LOCKED)
                    ? "A nominee is waiting; confirm or decline in the review panel."
                    : liveSnapshot.draftPhase === DraftPhase.LIVE
                      ? "Owners choose on their phones. Finalize nominees when they appear."
                      : paused
                        ? "Auction paused. Owners see paused until you resume."
                        : liveSnapshot.draftPhase === DraftPhase.FROZEN
                          ? "Big screens frozen for a pause or sponsor break. Unlock when ready."
                          : liveSnapshot.draftPhase === DraftPhase.LOCKED
                            ? "Nominations are paused at the commissioner lock. Owners wait until you unlock."
                            : setupOrReady
                              ? "Shuffle franchise order once, tap Start auction, then confirm each nominee as it arrives."
                              : ""}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
              {liveSnapshot.draftPhase === DraftPhase.LIVE ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full whitespace-nowrap sm:w-auto sm:min-w-[9.5rem]"
                  onClick={() => void fire("Paused", () => pauseDraftAction({ tournamentSlug: s }))}
                >
                  Pause auction
                </Button>
              ) : liveSnapshot.draftPhase === DraftPhase.PAUSED ? (
                <Button
                  type="button"
                  className="min-h-11 w-full whitespace-nowrap sm:w-auto sm:min-w-[9.5rem]"
                  onClick={() =>
                    void fire("Live again", () => resumeDraftAction({ tournamentSlug: s }))
                  }
                >
                  Resume auction
                </Button>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  aria-haspopup="menu"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "min-h-11 w-full shrink-0 justify-between gap-2 px-4 sm:w-auto sm:justify-center",
                  )}
                >
                  Advanced
                  <ChevronDownIcon className="size-4 opacity-70" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(calc(100vw-2rem),18rem)]">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Broadcast & flow</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Frozen", () => freezeDraftAction({ tournamentSlug: s }))
                      }
                    >
                      Freeze big screens (quiet moment)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Opened", () => unlockDraftAction({ tournamentSlug: s }))
                      }
                    >
                      Unlock big screens
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Locked", () => lockDraftAction({ tournamentSlug: s }))
                      }
                    >
                      Temporarily lock nominating flow
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Turn adjustments</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Turn reversed", () => previousTurnAction({ tournamentSlug: s }))
                      }
                    >
                      Reverse previous turn
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Skipped", () => skipTurnAction({ tournamentSlug: s }))
                      }
                    >
                      Skip current turn
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Advanced", () => nextTurnAction({ tournamentSlug: s }))
                      }
                    >
                      Advance to next turn
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Recovery & tooling</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Last pick undone", () => undoPickAction({ tournamentSlug: s }))
                      }
                    >
                      Undo last confirmation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        void fire("Screens pinged", () => forceSyncAction({ tournamentSlug: s }))
                      }
                    >
                      Ping all screens (sync bump)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (liveSnapshot.overrideValidation) {
                          void fire("Rules enforcing", () =>
                            toggleOverrideValidationAction({
                              tournamentSlug: s,
                              enabled: false,
                            }),
                          );
                          return;
                        }
                        setOverrideWarnOpen(true);
                      }}
                    >
                      {liveSnapshot.overrideValidation
                        ? "Enforce roster rules again"
                        : "Relax roster rules (exceptions only)"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setShortcutsHelpOpen(true)}>
                      Keyboard shortcuts…
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        void fire("Auction concluded", () => endDraftAction({ tournamentSlug: s }))
                      }
                    >
                      End auction
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <details className="group mt-4 rounded-xl border border-border/70 bg-muted/25">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium text-foreground sm:px-4 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <SparklesIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                Optional · limit owner board to one roster category
              </span>
              <ChevronDownIcon
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="border-t border-border/60 px-3 pt-2 pb-3 sm:px-4">
              <label className="sr-only" htmlFor={`admin-spotlight-${slug}`}>
                Spotlight roster category for owner devices
              </label>
              <Select
                value={spotlightSelectValue}
                onValueChange={(value) => {
                  if (value === spotlightSelectValue) return;
                  void fire("Spotlight updated", () =>
                    setAuctionSpotlightCategoryAction({
                      tournamentSlug: s,
                      rosterCategoryId: value,
                    }),
                  );
                }}
              >
                <SelectTrigger
                  id={`admin-spotlight-${slug}`}
                  className="w-full gap-2 bg-background"
                  aria-label={`Owner board focus: ${spotlightTriggerLabel}`}
                >
                  <SelectValue placeholder="Owners see every roster category">
                    {spotlightTriggerLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="OPEN">Everyone · all roster categories</SelectItem>
                  {liveSnapshot.squadRules.map((rule) => (
                    <SelectItem key={rule.rosterCategoryId} value={rule.rosterCategoryId}>
                      {rule.rosterCategoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {liveSnapshot.auctionSpotlightRosterCategoryName ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Owners see
                  <RosterCategoryPill
                    name={liveSnapshot.auctionSpotlightRosterCategoryName}
                    colorHex={liveSnapshot.auctionSpotlightRosterCategoryColorHex}
                    className="text-[11px] font-normal"
                  />
                  · your commissioner desk stays full board.
                </p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Leave open during mixed rounds; tighten to one category only when everyone should
                  focus the same slate.
                </p>
              )}
            </div>
          </details>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-xl sm:p-5">
          <h2 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Auction setup
          </h2>
          {!setupOrReady ? (
            <div className="mt-3 rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4 lg:gap-6">
                <h3 className="shrink-0 text-base font-semibold tracking-tight md:max-w-[10.5rem] lg:pt-0.5">
                  Setup tools are closed
                </h3>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground md:border-l md:border-border/60 md:pl-4 lg:pl-5">
                  <strong className="font-medium text-foreground">Shuffle pick order</strong> and{" "}
                  <strong className="font-medium text-foreground">Start auction</strong> apply only
                  before the room goes live; the server freezes pick order mid-auction for
                  stability.
                </p>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground md:border-l md:border-border/60 md:pl-4 lg:pl-5">
                  Use the banner for <strong className="font-medium text-foreground">Pause</strong>{" "}
                  / <strong className="font-medium text-foreground">Resume</strong> and{" "}
                  <strong className="font-medium text-foreground">Advanced</strong> for freeze, end
                  auction, or rare turn fixes.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-0">
              <div className="min-w-0 space-y-3 lg:pr-8">
                <h3 className="text-base font-semibold tracking-tight">Step 1 · Pick order</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Randomize franchises into a fair snake order. Reshuffle any time while status is
                  still setup or ready.
                </p>
                <RandomDraftOrderShuffle
                  tournamentSlug={s}
                  teams={liveSnapshot.teams.map((t) => ({ id: t.id, name: t.name }))}
                  finalOrderTeamIds={firstRoundTeamIds}
                  isFirstShuffle={liveSnapshot.draftSlotsTotal === 0}
                  className="min-h-12 w-full"
                  allowShuffle={canShuffleDraftOrder}
                  unavailableReason={shuffleUnavailableReason}
                />
              </div>
              <div className="min-w-0 space-y-3 border-border/70 pt-2 lg:border-l lg:pt-0 lg:pl-8">
                <h3 className="text-base font-semibold tracking-tight">Step 2 · Open the room</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  After the order feels right, go live once. Owners nominate on their phones; you
                  confirm here.
                </p>
                <Button
                  type="button"
                  className="mt-2 h-12 w-full max-w-md text-base font-semibold"
                  size="lg"
                  disabled={!canStartAuction}
                  title={canStartAuction ? undefined : startAuctionDisabledReason}
                  onClick={() =>
                    void fire("Auction running", () => startDraftAction({ tournamentSlug: s }))
                  }
                >
                  Start auction
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {canStartAuction
                    ? "One tap moves the tournament LIVE. Commissioners still finalize each nominee in the banner or review panel."
                    : startAuctionDisabledReason}
                </p>
              </div>
            </div>
          )}
        </section>

        <section
          className="flex min-h-[min(calc(100vh-18rem),800px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/60 shadow-inner backdrop-blur-md"
          aria-label="Commissioner roster desk"
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3">
            <DraftRoomClient
              slug={slug}
              initialSnapshot={initialSnapshot}
              controlledSnapshot={liveSnapshot}
              syncEnabled={false}
              viewerUserId={viewerUserId}
              enableOwnerPick={false}
              auctionDeskLayout
              showBoardDensityToggle={false}
              emphasizePlayerPresentation
              stretchToFit
              deskTwoColumnLayout
              applyLiveAuctionSpotlightBoardFilter={false}
            />
          </div>
        </section>
      </div>
    </>
  );
}
