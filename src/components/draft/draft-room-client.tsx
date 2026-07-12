"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Rows3Icon, ScanSearchIcon } from "lucide-react";
import { toast } from "sonner";

import { ActivityFeedTime } from "@/components/draft/activity-feed-time";
import { DraftOrderRevealOverlay } from "@/components/draft/draft-order-reveal-overlay";
import { PlayerCard } from "@/components/draft/player-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DRAFT_PHASE_LABEL } from "@/constants/draft-phase-labels";
import { GENDER_LABEL } from "@/constants/player-labels";
import { requestPickAction } from "@/features/draft/actions";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { DraftPhase, type Gender } from "@/generated/prisma/enums";
import { useDraftLiveSync } from "@/hooks/use-draft-live-sync";
import { getDraftProgressDisplay } from "@/lib/draft/draft-progress";
import { cn } from "@/lib/utils";
import { useDraftBoardUiStore } from "@/store/draft-board-store";
import type { DraftSnapshotDto } from "@/types/draft";

interface DraftRoomClientProps {
  slug: string;
  initialSnapshot: DraftSnapshotDto;
  viewerUserId: string | null;
  enableOwnerPick: boolean;
  /**
   * Franchise-owner phone route: never show nominate controls unless this login owns the on-clock team;
   * hide full pick order; clarify copy so other franchises' turns are read-only.
   */
  franchiseOwnerPhoneMode?: boolean;
  /** When set, rendering uses this snapshot (e.g. admin embed with single upstream sync). */
  controlledSnapshot?: DraftSnapshotDto;
  /** Subscribe to polling/realtime updates (disable when parent owns sync). */
  syncEnabled?: boolean;
  /**
   * When the commissioner set a LIVE roster spotlight, franchise + public draft rooms filter the board to that group.
   * Commissioner desk embeds set `false` so every group stays browsable.
   */
  applyLiveAuctionSpotlightBoardFilter?: boolean;
  /**
   * Spacious layout vs. commissioner control desk: tighter chrome, scroll-heavy board grid.
   */
  auctionDeskLayout?: boolean;
  /** Show compact/comfortable player tile toggle (auction desk only). */
  showBoardDensityToggle?: boolean;
  /**
   * Commissioner desk only: enlarge portraits and lighten chrome so mugs read well when presenting.
   */
  emphasizePlayerPresentation?: boolean;
  /** Stretch within a flex/grid parent so the embedded board fills available height. */
  stretchToFit?: boolean;
  /**
   * Commissioner embed: use a two-column grid (audit rail | player board) instead of a flex row.
   * Pair with `auctionDeskLayout` and usually `stretchToFit`.
   */
  deskTwoColumnLayout?: boolean;
}

export function DraftRoomClient({
  slug,
  initialSnapshot,
  viewerUserId,
  enableOwnerPick,
  franchiseOwnerPhoneMode = false,
  controlledSnapshot,
  syncEnabled = true,
  applyLiveAuctionSpotlightBoardFilter,
  auctionDeskLayout = false,
  showBoardDensityToggle = false,
  emphasizePlayerPresentation = false,
  stretchToFit = false,
  deskTwoColumnLayout = false,
}: DraftRoomClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [submittingPlayerId, setSubmittingPlayerId] = useState<string | null>(null);
  const liveBoardSync = syncEnabled && !controlledSnapshot;

  const refreshedSnapshot = controlledSnapshot ?? snapshot;
  const acceleratedSync =
    refreshedSnapshot.draftPhase === DraftPhase.LIVE ||
    refreshedSnapshot.draftPhase === DraftPhase.PAUSED;

  useDraftLiveSync(slug, liveBoardSync ? refreshedSnapshot.tournamentId : undefined, setSnapshot, {
    enabled: liveBoardSync,
    accelerated: acceleratedSync,
  });

  const effectiveSnapshot = controlledSnapshot ?? snapshot;

  const search = useDraftBoardUiStore((s) => s.search);
  const categoryFilter = useDraftBoardUiStore((s) => s.categoryFilter);
  const genderFilter = useDraftBoardUiStore((s) => s.genderFilter);
  const sortMode = useDraftBoardUiStore((s) => s.sortMode);
  const playerBoardDensity = useDraftBoardUiStore((s) => s.playerBoardDensity);
  const setSearch = useDraftBoardUiStore((s) => s.setSearch);
  const setCategoryFilter = useDraftBoardUiStore((s) => s.setCategoryFilter);
  const setGenderFilter = useDraftBoardUiStore((s) => s.setGenderFilter);
  const setSortMode = useDraftBoardUiStore((s) => s.setSortMode);
  const togglePlayerBoardDensity = useDraftBoardUiStore((s) => s.togglePlayerBoardDensity);

  const teamsById = useMemo(() => {
    const map: Record<string, (typeof effectiveSnapshot.teams)[0]> = {};
    effectiveSnapshot.teams.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [effectiveSnapshot]);

  const rosterCategoryRank = useMemo(() => {
    const map = new Map<string, number>();
    effectiveSnapshot.squadRules.forEach((rule, index) => {
      map.set(rule.rosterCategoryId, index);
    });
    return map;
  }, [effectiveSnapshot.squadRules]);

  const currentTurnTeamId = useMemo(() => {
    const slot = effectiveSnapshot.draftSlots.find(
      (s) => s.slotIndex === effectiveSnapshot.currentSlotIndex,
    );
    return slot?.teamId ?? null;
  }, [effectiveSnapshot.currentSlotIndex, effectiveSnapshot.draftSlots]);

  const currentTeam = currentTurnTeamId ? teamsById[currentTurnTeamId] : null;

  const viewerFranchiseTeams = useMemo(() => {
    if (!viewerUserId) return [];
    return effectiveSnapshot.teams.filter((t) => t.ownerUserId === viewerUserId);
  }, [effectiveSnapshot.teams, viewerUserId]);

  const viewerOwnsClock =
    Boolean(enableOwnerPick) &&
    Boolean(viewerUserId) &&
    Boolean(currentTurnTeamId) &&
    teamsById[currentTurnTeamId ?? ""]?.ownerUserId === viewerUserId;

  const viewerPendingNomination =
    viewerOwnsClock &&
    effectiveSnapshot.pendingPickTeamId === currentTurnTeamId &&
    effectiveSnapshot.pendingPickPlayerId !== null;

  const handleNominate = useCallback(
    async (playerId: string) => {
      setSubmittingPlayerId(playerId);
      const result = await requestPickAction({
        tournamentSlug: slug,
        playerId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setSubmittingPlayerId(null);
        toast.error(result.error);
        return;
      }
      setSubmittingPlayerId(null);
      toast.success("Your pick was sent. The admin will confirm it.");
    },
    [slug],
  );

  const draftLive = effectiveSnapshot.draftPhase === DraftPhase.LIVE;
  const spotlightId = effectiveSnapshot.auctionSpotlightRosterCategoryId;
  const applyBoardSpotlight =
    (applyLiveAuctionSpotlightBoardFilter ?? true) && draftLive && spotlightId !== null;

  useEffect(() => {
    if (!draftLive || !spotlightId) return;
    if (!applyBoardSpotlight) return;
    if (categoryFilter !== spotlightId) {
      setCategoryFilter(spotlightId);
    }
  }, [draftLive, spotlightId, applyBoardSpotlight, categoryFilter, setCategoryFilter]);

  const liveSpotlightLocksRound = draftLive && spotlightId !== null;

  const filteredPlayers = useMemo(() => {
    let list = effectiveSnapshot.players.filter((player) => !player.runsFranchiseLogin);

    if (applyBoardSpotlight && spotlightId) {
      list = list.filter((p) => p.rosterCategoryId === spotlightId);
    }

    if (categoryFilter !== "ALL") {
      list = list.filter((p) => p.rosterCategoryId === categoryFilter);
    }
    if (genderFilter !== "ALL") {
      list = list.filter((p) => p.gender === genderFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortMode === "name_asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "category") {
      sorted.sort((a, b) => {
        const ar = rosterCategoryRank.get(a.rosterCategoryId) ?? 999;
        const br = rosterCategoryRank.get(b.rosterCategoryId) ?? 999;
        if (ar !== br) return ar - br;
        return a.rosterCategoryName.localeCompare(b.rosterCategoryName, undefined, {
          sensitivity: "base",
        });
      });
    } else {
      sorted.sort((a, b) => {
        const av =
          Number(a.hasConfirmedPick) + Number(Boolean(a.assignedTeamId && !a.hasConfirmedPick));
        const bv =
          Number(b.hasConfirmedPick) + Number(Boolean(b.assignedTeamId && !b.hasConfirmedPick));
        if (av !== bv) {
          return av - bv;
        }
        return Number(a.runsFranchiseLogin) - Number(b.runsFranchiseLogin);
      });
    }
    return sorted;
  }, [
    applyBoardSpotlight,
    spotlightId,
    categoryFilter,
    genderFilter,
    search,
    effectiveSnapshot.players,
    rosterCategoryRank,
    sortMode,
  ]);

  const hideFranchiseOwnerNominate = franchiseOwnerPhoneMode && (!draftLive || !viewerOwnsClock);

  const nominateActionsAllowed = !franchiseOwnerPhoneMode || viewerOwnsClock;

  const genderKeys = Object.keys(GENDER_LABEL) as Gender[];

  const rosterGroupTriggerLabel = useMemo(() => {
    if (categoryFilter === "ALL") {
      return "All groups";
    }
    const rule = effectiveSnapshot.squadRules.find(
      (row) => row.rosterCategoryId === categoryFilter,
    );
    if (rule) {
      return rule.rosterCategoryName;
    }
    const sample = effectiveSnapshot.players.find((p) => p.rosterCategoryId === categoryFilter);
    return sample?.rosterCategoryName ?? "Roster group";
  }, [categoryFilter, effectiveSnapshot.players, effectiveSnapshot.squadRules]);

  const genderTriggerLabel = genderFilter === "ALL" ? "All" : GENDER_LABEL[genderFilter];

  const sortTriggerLabel =
    sortMode === "availability"
      ? "Free players first"
      : sortMode === "name_asc"
        ? "Name A → Z"
        : "Group";
  const draftProgress = getDraftProgressDisplay(effectiveSnapshot);
  const hideCompletedOwnerClockSection =
    franchiseOwnerPhoneMode && effectiveSnapshot.draftPhase === DraftPhase.COMPLETED;

  const sidebarNowCard = (
    <div className="rounded-xl border border-border/80 bg-card/40 p-3 backdrop-blur-md sm:p-4">
      <p className="text-xs font-medium text-muted-foreground">Now</p>
      <h2 className="mt-1 leading-tight font-semibold">{effectiveSnapshot.name}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{DRAFT_PHASE_LABEL[effectiveSnapshot.draftPhase]}</Badge>
        <Badge variant="secondary">
          Pick {draftProgress.displayPickCount} / {effectiveSnapshot.draftSlotsTotal || "-"}
        </Badge>
      </div>
      <Separator className="my-3 sm:my-4" />
      <div className="space-y-2">
        {!hideCompletedOwnerClockSection ? (
          <>
            <p className="text-xs font-medium text-muted-foreground">Who picks now</p>
            <div
              className={cn(
                "rounded-lg border px-3 py-3 text-sm font-semibold transition-all",
                draftLive && currentTeam
                  ? "border-primary/60 bg-primary/10 shadow-[0_0_30px_-14px_rgba(56,189,248,0.9)]"
                  : "border-border bg-muted/30",
              )}
            >
              {currentTeam?.name ?? "-"}
            </div>
          </>
        ) : null}
        {draftLive &&
        applyBoardSpotlight &&
        spotlightId &&
        effectiveSnapshot.auctionSpotlightRosterCategoryName ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-500/25 bg-sky-500/5 px-2 py-2">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Live round
            </span>
            <RosterCategoryPill
              name={effectiveSnapshot.auctionSpotlightRosterCategoryName}
              colorHex={effectiveSnapshot.auctionSpotlightRosterCategoryColorHex}
              className="text-xs font-normal"
            />
          </div>
        ) : null}
        {franchiseOwnerPhoneMode ? (
          <>
            {viewerFranchiseTeams.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Your franchise</span>
                {viewerFranchiseTeams.length > 1 ? "s" : ""}:{" "}
                {viewerFranchiseTeams.map((t) => t.name).join(", ")}
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No franchise is assigned to this login yet. Ask the commissioner to set you as owner
                on Teams.
              </p>
            )}
            {draftLive && currentTeam ? (
              viewerOwnsClock ? (
                viewerPendingNomination ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Pick sent for review. Other players stay locked until the organizer confirms or
                    declines it.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Your franchise is on the clock. Tap a player below.
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{currentTeam.name}</span> is picking
                  now. You cannot submit a pick for other franchises; browse only until it is your
                  team&apos;s turn.
                </p>
              )
            ) : draftLive ? (
              <p className="text-xs text-muted-foreground">
                Waiting for the next pick slot. You only submit picks when your franchise is
                highlighted.
              </p>
            ) : null}
          </>
        ) : viewerOwnsClock ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">It is your turn to pick.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only the team owner (or admin) can tap a player on this turn.
          </p>
        )}
      </div>
    </div>
  );

  const sidebarOrderCard = (
    <div className="rounded-xl border border-border/80 bg-card/30 p-3 backdrop-blur-md sm:p-4">
      <p className="text-xs font-medium text-muted-foreground">Pick order</p>
      {franchiseOwnerPhoneMode ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Full turn order is hidden on this screen so you only act for your franchise. The room
          display shows everyone&apos;s order.
        </p>
      ) : (
        <ScrollArea
          className={cn("mt-3 pr-3", auctionDeskLayout ? "h-32 sm:h-40" : "h-44 sm:h-64")}
        >
          <ol className="space-y-2 text-sm">
            {effectiveSnapshot.draftSlots.map((slot) => {
              const team = teamsById[slot.teamId];
              const active = slot.slotIndex === effectiveSnapshot.currentSlotIndex;
              return (
                <li
                  key={slot.slotIndex}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-2 py-1.5",
                    active ? "border-primary/70 bg-primary/10" : "border-transparent bg-muted/20",
                  )}
                >
                  <span className="text-xs text-muted-foreground">#{slot.slotIndex + 1}</span>
                  <span className="truncate font-medium">{team?.name ?? slot.teamId}</span>
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      )}
    </div>
  );

  const sidebarFeedCard = (
    <div className="rounded-xl border border-border/80 bg-card/30 p-3 backdrop-blur-md sm:p-4">
      <p className="text-xs font-medium text-muted-foreground">What happened</p>
      <ScrollArea className={cn("mt-3 pr-3", auctionDeskLayout ? "h-28 sm:h-32" : "h-36 sm:h-48")}>
        <ul className="space-y-2 text-xs text-muted-foreground">
          {effectiveSnapshot.activity.slice(0, 25).map((entry) => (
            <li key={entry.id} className="rounded-md bg-muted/30 px-2 py-1">
              <span className="font-semibold text-foreground">{entry.action}</span>
              {entry.message ? ` · ${entry.message}` : null}
              <ActivityFeedTime iso={entry.createdAt} />
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );

  const presentBoard = emphasizePlayerPresentation && auctionDeskLayout;
  const embeddedStretch = stretchToFit && auctionDeskLayout;
  const splitAuditBoard = auctionDeskLayout && deskTwoColumnLayout;

  const sidebarStack = (
    <aside
      className={cn(
        "w-full shrink-0 space-y-3 sm:space-y-4",
        splitAuditBoard
          ? "min-h-0 min-w-0 lg:max-h-full lg:overflow-y-auto lg:pr-1"
          : auctionDeskLayout
            ? presentBoard
              ? "lg:w-52 xl:w-56"
              : "lg:w-64 xl:w-72"
            : "lg:w-72 lg:self-start xl:w-80",
      )}
    >
      {sidebarNowCard}
      {sidebarOrderCard}
      {sidebarFeedCard}
    </aside>
  );

  const filterFieldIds = {
    search: `draft-filter-search-${slug}`,
    rosterGroup: `draft-filter-roster-${slug}`,
    gender: `draft-filter-gender-${slug}`,
    sort: `draft-filter-sort-${slug}`,
  };

  const rosterGroupControl =
    applyBoardSpotlight && spotlightId && effectiveSnapshot.auctionSpotlightRosterCategoryName ? (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 sm:min-h-8 sm:py-2",
          presentBoard && "border-border/55",
        )}
        role="status"
        aria-label={`Roster group locked to ${effectiveSnapshot.auctionSpotlightRosterCategoryName ?? "spotlight"}`}
      >
        <RosterCategoryPill
          name={effectiveSnapshot.auctionSpotlightRosterCategoryName}
          colorHex={effectiveSnapshot.auctionSpotlightRosterCategoryColorHex}
          className="text-sm font-normal"
        />
        <span className="text-[11px] text-muted-foreground sm:text-xs">Nominees only</span>
      </div>
    ) : (
      <Select
        value={categoryFilter}
        onValueChange={(value) => setCategoryFilter(value as typeof categoryFilter)}
      >
        <SelectTrigger
          id={filterFieldIds.rosterGroup}
          className="h-8 w-full min-w-0 bg-background/60"
        >
          <SelectValue placeholder="All groups">{rosterGroupTriggerLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All groups</SelectItem>
          {effectiveSnapshot.squadRules.map((rule) => (
            <SelectItem
              key={rule.rosterCategoryId}
              value={rule.rosterCategoryId}
              disabled={
                liveSpotlightLocksRound &&
                !applyBoardSpotlight &&
                rule.rosterCategoryId !== spotlightId
              }
            >
              <span className={cn(rule.rosterCategoryId === spotlightId && "font-semibold")}>
                {rule.rosterCategoryName}
                {liveSpotlightLocksRound && rule.rosterCategoryId === spotlightId
                  ? " · owner spotlight"
                  : ""}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  const filterToolbar = (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 rounded-xl border border-border/80 bg-card/20 p-3 backdrop-blur-md sm:gap-4 sm:p-4",
        showBoardDensityToggle
          ? "lg:grid-cols-[minmax(10rem,1.25fr)_minmax(9rem,1fr)_minmax(8rem,0.95fr)_minmax(8rem,0.95fr)_minmax(8rem,0.95fr)]"
          : "lg:grid-cols-[minmax(10rem,1.35fr)_minmax(9rem,1fr)_minmax(8rem,1fr)_minmax(9rem,1fr)]",
        "lg:items-start lg:gap-x-4",
        presentBoard && "gap-3 border-border/60 bg-card/10 p-2.5 sm:gap-3 sm:p-3 lg:gap-x-3",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
        <label
          className="text-xs font-medium text-muted-foreground sm:text-sm"
          htmlFor={filterFieldIds.search}
        >
          Find by name
        </label>
        <Input
          id={filterFieldIds.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Type part of a name"
          className="h-8 w-full min-w-0 bg-background/60"
          autoComplete="off"
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
        {applyBoardSpotlight &&
        spotlightId &&
        effectiveSnapshot.auctionSpotlightRosterCategoryName ? (
          <span className="text-xs font-medium text-muted-foreground sm:text-sm">Roster group</span>
        ) : (
          <label
            className="text-xs font-medium text-muted-foreground sm:text-sm"
            htmlFor={filterFieldIds.rosterGroup}
          >
            Roster group
          </label>
        )}
        {rosterGroupControl}
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
        <label
          className="text-xs font-medium text-muted-foreground sm:text-sm"
          htmlFor={filterFieldIds.gender}
        >
          Gender
        </label>
        <Select
          value={genderFilter}
          onValueChange={(value) => setGenderFilter(value as Gender | "ALL")}
        >
          <SelectTrigger id={filterFieldIds.gender} className="h-8 w-full min-w-0 bg-background/60">
            <SelectValue placeholder="All">{genderTriggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {genderKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {GENDER_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
        <label
          className="text-xs font-medium text-muted-foreground sm:text-sm"
          htmlFor={filterFieldIds.sort}
        >
          Sort
        </label>
        <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
          <SelectTrigger id={filterFieldIds.sort} className="h-8 w-full min-w-0 bg-background/60">
            <SelectValue placeholder="Sort">{sortTriggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="availability">Free players first</SelectItem>
            <SelectItem value="name_asc">Name A → Z</SelectItem>
            <SelectItem value="category">Group</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showBoardDensityToggle ? (
        <div className="flex min-h-0 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground sm:text-sm">Tile size</span>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full min-w-0 gap-2 bg-background/60 px-2.5 sm:justify-center"
            title="Toggle nominee tile density"
            onClick={() => togglePlayerBoardDensity()}
          >
            {playerBoardDensity === "compact" ? (
              <ScanSearchIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            ) : (
              <Rows3Icon className="size-4 shrink-0 opacity-70" aria-hidden />
            )}
            <span className="truncate text-xs font-medium tracking-wide uppercase">
              {playerBoardDensity === "compact" ? "Compact" : "Comfortable"}
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );

  const playerGridClasses = cn(
    "gap-4",
    auctionDeskLayout
      ? playerBoardDensity === "compact"
        ? presentBoard
          ? "grid grid-cols-2 sm:gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          : "grid grid-cols-2 sm:gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7"
        : presentBoard
          ? "grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4"
          : "grid grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      : "grid grid-cols-1 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
  );

  const playerBoard = (
    <div className={playerGridClasses}>
      {filteredPlayers.map((player) => {
        const team = player.assignedTeamId ? teamsById[player.assignedTeamId] : undefined;
        const canNominateThisCard =
          nominateActionsAllowed &&
          draftLive &&
          viewerOwnsClock &&
          !player.hasConfirmedPick &&
          !player.isUnavailable &&
          !player.isLocked &&
          !player.runsFranchiseLogin &&
          !player.assignedTeamId;
        const nominateLoading = submittingPlayerId === player.id;
        const nominateDisabled =
          !canNominateThisCard || viewerPendingNomination || submittingPlayerId !== null;

        return (
          <PlayerCard
            key={player.id}
            player={player}
            team={team}
            emphasize={Boolean(canNominateThisCard)}
            hideNominateControl={hideFranchiseOwnerNominate}
            presentationHighlight={presentBoard}
            compact={auctionDeskLayout ? playerBoardDensity === "compact" : false}
            onNominate={canNominateThisCard ? () => void handleNominate(player.id) : undefined}
            nominateDisabled={nominateDisabled}
            nominateLoading={nominateLoading}
          />
        );
      })}
    </div>
  );

  const contentMain = (
    <section
      className={cn(
        "min-h-0 min-w-0 flex-1 space-y-3 sm:space-y-4",
        presentBoard && "space-y-2 sm:space-y-3",
        (embeddedStretch || splitAuditBoard) && "flex min-h-0 flex-col",
      )}
    >
      {liveSpotlightLocksRound &&
      !applyBoardSpotlight &&
      effectiveSnapshot.auctionSpotlightRosterCategoryName ? (
        <div
          className="rounded-xl border border-sky-500/30 bg-sky-500/[0.07] px-4 py-3 text-sm leading-relaxed text-foreground backdrop-blur-sm"
          role="status"
        >
          <span className="font-semibold text-foreground">Commissioner spotlight</span> locked to{" "}
          <RosterCategoryPill
            name={effectiveSnapshot.auctionSpotlightRosterCategoryName}
            colorHex={effectiveSnapshot.auctionSpotlightRosterCategoryColorHex}
            className="align-middle text-xs font-normal"
          />{" "}
          : franchises only see nominees in this group; you retain the full roster for desk review.
        </div>
      ) : null}

      {filterToolbar}

      {franchiseOwnerPhoneMode && draftLive && !viewerOwnsClock ? (
        <div
          className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          Browse mode:{" "}
          <span className="font-medium text-foreground">
            {currentTeam?.name ?? "Another franchise"}
          </span>{" "}
          is picking. Submit buttons appear only when your franchise is on the clock.
        </div>
      ) : null}

      {viewerPendingNomination ? (
        <div
          className="rounded-xl border border-amber-400/45 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:text-amber-100"
          role="status"
        >
          Your latest pick is waiting for organizer approval. You cannot choose another player until
          they confirm or decline it.
        </div>
      ) : null}

      {auctionDeskLayout ? (
        embeddedStretch ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ScrollArea
              className={cn(
                "min-h-0 flex-1 rounded-xl border border-border/70 bg-muted/15 pr-3",
                presentBoard && "border-primary/15 bg-muted/10",
              )}
            >
              <div className={cn("p-3", presentBoard && "p-2.5 sm:p-4")}>{playerBoard}</div>
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea
            className={cn(
              "min-h-[min(540px,calc(100vh-12rem))] rounded-xl border border-border/70 bg-muted/15 pr-3",
              presentBoard && "border-primary/15 bg-muted/10",
            )}
          >
            <div className={cn("p-3", presentBoard && "p-2.5 sm:p-4")}>{playerBoard}</div>
          </ScrollArea>
        )
      ) : (
        playerBoard
      )}
    </section>
  );

  return (
    <>
      <DraftOrderRevealOverlay
        slug={slug}
        draftPhase={effectiveSnapshot.draftPhase}
        draftSlots={effectiveSnapshot.draftSlots}
        teams={effectiveSnapshot.teams}
      />
      <div
        className={
          splitAuditBoard
            ? cn(
                "grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(200px,25%)_minmax(0,1fr)] lg:items-stretch lg:gap-6",
                embeddedStretch && "flex-1",
              )
            : cn(
                "flex min-h-0 flex-col gap-4",
                embeddedStretch && "flex-1 lg:flex-row lg:gap-5",
                auctionDeskLayout &&
                  !embeddedStretch &&
                  "lg:min-h-[min(760px,calc(100vh-13rem))] lg:flex-row",
                !auctionDeskLayout && "lg:min-h-[calc(100vh-8rem)] lg:flex-row",
              )
        }
      >
        {sidebarStack}
        {contentMain}
      </div>
    </>
  );
}
