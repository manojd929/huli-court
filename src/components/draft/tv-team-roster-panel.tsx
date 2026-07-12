"use client";

import Image from "next/image";

import { TvRosterPlayerTile } from "@/components/draft/tv-roster-player-tile";
import { Badge } from "@/components/ui/badge";
import type { DraftPlayerDto, DraftTeamDto } from "@/types/draft";
import { cn } from "@/lib/utils";

interface CategoryGroup {
  rosterCategoryId: string;
  rosterCategoryName: string;
  players: DraftPlayerDto[];
}

/** Responsive grid for player tiles: dense on phones, breathable on larger screens */
const playerTilesGrid =
  "grid grid-cols-2 gap-2.5 xs:gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] lg:gap-5";

function groupPlayersByCategory(
  players: DraftPlayerDto[],
  rosterCategoryRank: Map<string, number>,
): CategoryGroup[] {
  const sorted = [...players].sort((a, b) => {
    const ra = rosterCategoryRank.get(a.rosterCategoryId) ?? 999;
    const rb = rosterCategoryRank.get(b.rosterCategoryId) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const groups: CategoryGroup[] = [];
  for (const player of sorted) {
    const last = groups[groups.length - 1];
    if (last?.rosterCategoryId === player.rosterCategoryId) {
      last.players.push(player);
      continue;
    }
    groups.push({
      rosterCategoryId: player.rosterCategoryId,
      rosterCategoryName: player.rosterCategoryName,
      players: [player],
    });
  }
  return groups;
}

interface TvTeamRosterPanelProps {
  team: DraftTeamDto;
  confirmedPlayers: DraftPlayerDto[];
  pendingPlayers: DraftPlayerDto[];
  rosterCategoryRank: Map<string, number>;
  isOnClock: boolean;
}

export function TvTeamRosterPanel({
  team,
  confirmedPlayers,
  pendingPlayers,
  rosterCategoryRank,
  isOnClock,
}: TvTeamRosterPanelProps) {
  const totalOnRoster = confirmedPlayers.length + pendingPlayers.length;
  const ownerPlayer = confirmedPlayers.find((player) => player.runsFranchiseLogin) ?? null;
  const groups = groupPlayersByCategory(confirmedPlayers, rosterCategoryRank);

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card/90 shadow-sm backdrop-blur-md dark:bg-gradient-to-b dark:from-white/[0.07] dark:to-black/50 dark:shadow-inner",
        isOnClock
          ? "shadow-md ring-2 shadow-primary/10 ring-primary/35 dark:border-sky-400/35 dark:shadow-[0_0_48px_-16px_rgba(56,189,248,0.45)]"
          : "",
      )}
    >
      <header
        className="relative flex shrink-0 flex-wrap items-start gap-3 border-b border-border p-4 sm:flex-nowrap sm:gap-4 sm:p-5 md:p-6 dark:border-white/10"
        style={
          team.colorHex && /^#[0-9A-Fa-f]{6}$/u.test(team.colorHex)
            ? {
                borderLeftWidth: 6,
                borderLeftStyle: "solid",
                borderLeftColor: team.colorHex,
              }
            : undefined
        }
      >
        <div className="relative size-[3rem] shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:size-14 md:size-16 dark:border-white/15 dark:bg-black/35">
          {team.logoUrl ? (
            <Image
              src={team.logoUrl}
              alt={`${team.name} logo`}
              fill
              className="object-contain p-1.5 sm:p-2"
              sizes="64px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-bold text-muted-foreground sm:text-xl dark:text-white/60">
              {team.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[clamp(1rem,4vw,1.7rem)] font-bold tracking-tight text-balance text-foreground md:text-[clamp(1.1rem,1.5vw,1.75rem)] dark:text-white">
              {team.name}
            </h2>
            {team.shortName ? (
              <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium tracking-wider text-foreground uppercase sm:text-[11px] dark:border-white/15 dark:bg-white/10 dark:text-sky-100">
                {team.shortName}
              </span>
            ) : null}
            {isOnClock ? (
              <Badge className="border-primary/35 bg-primary/15 text-[9px] font-semibold tracking-widest text-primary uppercase dark:border-sky-400/45 dark:bg-sky-500/25 dark:text-sky-50">
                On the clock
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground sm:text-[13px] dark:text-white/65">
            Roster ·{" "}
            <span className="font-semibold text-foreground dark:text-white">{totalOnRoster}</span>
            {" · "}
            <span className="text-foreground dark:text-white/80">
              {confirmedPlayers.length}
            </span>{" "}
            confirmed
            {pendingPlayers.length > 0 ? (
              <>
                {" · "}
                <span className="font-medium text-amber-700 dark:text-amber-200">
                  {pendingPlayers.length}
                </span>{" "}
                pending
              </>
            ) : null}
          </p>
          {ownerPlayer ? (
            <p className="mt-1 text-[12px] text-muted-foreground sm:text-[13px] dark:text-white/65">
              Owner ·{" "}
              <span className="font-semibold text-foreground dark:text-white">
                {ownerPlayer.name}
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-4 sm:min-h-[240px] sm:px-5 sm:py-5 md:px-6 md:py-6">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-webkit-overflow-scrolling:touch]">
          {pendingPlayers.length > 0 ? (
            <div className="mb-8 space-y-3">
              <h3 className="text-[10px] font-semibold tracking-[0.24em] text-amber-800 uppercase sm:text-[11px] dark:text-amber-200/90">
                Nomination pending commissioner
              </h3>
              <div className={playerTilesGrid}>
                {pendingPlayers.map((player) => (
                  <TvRosterPlayerTile key={player.id} player={player} variant="pending" />
                ))}
              </div>
            </div>
          ) : null}

          {groups.length === 0 && pendingPlayers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground sm:text-base dark:text-white/50">
              No drafted players yet.
            </p>
          ) : null}

          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.rosterCategoryId} className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-3 border-b border-border pb-2 dark:border-white/10">
                  <h3 className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase sm:text-[12px] dark:text-white/70">
                    {group.rosterCategoryName}
                  </h3>
                  <span className="text-[11px] text-muted-foreground sm:text-[12px] dark:text-white/45">
                    {group.players.length} pick{group.players.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className={playerTilesGrid}>
                  {group.players.map((player) => (
                    <TvRosterPlayerTile key={player.id} player={player} variant="confirmed" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
