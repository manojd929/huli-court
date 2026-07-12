"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { LoaderCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { cn } from "@/lib/utils";
import type { DraftPlayerDto, DraftTeamDto } from "@/types/draft";
import { GENDER_LABEL } from "@/constants/player-labels";

interface PlayerCardProps {
  player: DraftPlayerDto;
  team?: DraftTeamDto | null;
  emphasize: boolean;
  onNominate?: () => void;
  nominateDisabled?: boolean;
  nominateLoading?: boolean;
  /** When true, never render nominate control (defense-in-depth for franchise-owner phone UI). */
  hideNominateControl?: boolean;
  /** High-density tiles for commissioner boards with many nominees. */
  compact?: boolean;
  /** Commissioner presenting: enlarge portrait frame and deepen card presence. */
  presentationHighlight?: boolean;
}

const badgeWrap =
  "h-auto min-h-7 max-w-full whitespace-normal px-2.5 py-1 text-xs leading-snug sm:text-sm";

export function PlayerCard({
  player,
  team,
  emphasize,
  onNominate,
  nominateDisabled,
  nominateLoading = false,
  hideNominateControl,
  compact = false,
  presentationHighlight = false,
}: PlayerCardProps) {
  const picked = Boolean(player.hasConfirmedPick && player.assignedTeamId);
  const pending = !player.hasConfirmedPick && Boolean(player.assignedTeamId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full"
    >
      <Card
        data-state={picked ? "picked" : pending ? "pending" : "available"}
        className={cn(
          "relative flex h-full flex-col overflow-hidden border bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-300",
          presentationHighlight && !picked && !pending && "border-primary/20 bg-card shadow-md",
          compact ? "border-border/70 p-2 sm:p-2.5" : "p-3 sm:p-4",
          picked && "pointer-events-none scale-[0.99] border-muted opacity-65 grayscale",
          pending &&
            "border-amber-400/70 shadow-[0_0_40px_-12px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/40",
          !picked &&
            !pending &&
            emphasize &&
            "cursor-pointer border-primary/40 shadow-[0_0_28px_-10px_rgba(56,189,248,0.55)] hover:border-primary hover:shadow-[0_0_34px_-8px_rgba(56,189,248,0.65)]",
          !picked &&
            !pending &&
            player.runsFranchiseLogin &&
            "border-muted-foreground/30 bg-muted/30 opacity-75",
        )}
      >
        {(picked || pending) && (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent"
            aria-hidden
          />
        )}
        <div className={cn("relative flex flex-1 flex-col", compact ? "gap-2" : "gap-3")}>
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border",
              presentationHighlight &&
                "rounded-2xl bg-gradient-to-b from-muted to-muted/60 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.35)] ring-2 ring-primary/30 dark:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.55)]",
              compact
                ? presentationHighlight
                  ? "aspect-[5/6] max-h-none min-h-[11.5rem] sm:aspect-[4/5] sm:min-h-[13.5rem]"
                  : "aspect-[5/6] max-h-40 sm:aspect-square sm:max-h-44"
                : presentationHighlight
                  ? "aspect-[3/4] min-h-[210px] sm:min-h-[272px]"
                  : "aspect-[4/5]",
            )}
          >
            {player.photoUrl ? (
              <Image
                src={player.photoUrl}
                alt={player.name}
                fill
                sizes={
                  compact
                    ? presentationHighlight
                      ? "(max-width:640px) 45vw, 220px"
                      : "(max-width:640px) 50vw, 160px"
                    : presentationHighlight
                      ? "(max-width:640px) 90vw, (max-width:1280px) 40vw, 320px"
                      : "(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                }
                unoptimized
                className="object-contain object-center"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center font-semibold text-muted-foreground",
                  compact ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl",
                )}
                aria-hidden
              >
                {player.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p
              className={cn(
                "text-center leading-snug font-semibold tracking-tight break-words",
                compact
                  ? presentationHighlight
                    ? "text-[15px] sm:text-base"
                    : "text-sm sm:text-[15px]"
                  : presentationHighlight
                    ? "text-lg sm:text-xl"
                    : "text-base sm:text-lg",
              )}
            >
              {player.name}
            </p>
            <div
              className={cn(
                "flex flex-wrap justify-center gap-1",
                compact ? "gap-1" : "gap-1.5 sm:gap-2",
              )}
            >
              <RosterCategoryPill
                name={player.rosterCategoryName}
                colorHex={player.rosterCategoryColorHex}
                className={cn(
                  badgeWrap,
                  "justify-center text-center",
                  compact && "min-h-6 py-0.5 text-[11px]",
                )}
              />
              <Badge
                variant="outline"
                className={cn(badgeWrap, "text-center", compact && "min-h-6 py-0.5 text-[11px]")}
              >
                {GENDER_LABEL[player.gender]}
              </Badge>
              {player.isUnavailable ? (
                <Badge variant="destructive" className={cn(badgeWrap, "text-center")}>
                  Not here
                </Badge>
              ) : null}
              {player.isLocked ? (
                <Badge variant="outline" className={cn(badgeWrap, "text-center")}>
                  Locked
                </Badge>
              ) : null}
              {player.runsFranchiseLogin ? (
                <Badge variant="outline" className={cn(badgeWrap, "text-center")}>
                  Runs a franchise
                </Badge>
              ) : null}
            </div>
          </div>

          {player.notes ? (
            <p className="text-center text-sm leading-relaxed break-words text-muted-foreground sm:text-base">
              {player.notes}
            </p>
          ) : null}

          {picked && team ? (
            <div className="mt-auto flex flex-col gap-1 rounded-lg bg-muted/70 px-3 py-3 text-center sm:text-left">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:text-sm">
                Taken by
              </span>
              <span className="text-base leading-snug font-semibold break-words sm:text-lg">
                {team.name}
              </span>
            </div>
          ) : null}
          {pending && team ? (
            <div className="mt-auto rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-3 text-center text-sm leading-snug font-medium text-amber-950 sm:text-base dark:text-amber-100">
              Waiting for organizer · {team.shortName ?? team.name}
            </div>
          ) : null}
          {onNominate && !picked && !hideNominateControl ? (
            <button
              type="button"
              disabled={nominateDisabled || nominateLoading}
              onClick={onNominate}
              aria-busy={nominateLoading}
              className={cn(
                "mt-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-center font-semibold text-primary-foreground transition hover:bg-primary/90 active:translate-y-px active:scale-[0.985] active:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
                compact
                  ? "min-h-9 px-2 py-2 text-xs sm:text-[13px]"
                  : "min-h-12 px-4 py-3 text-base sm:min-h-14 sm:text-lg",
              )}
            >
              {nominateLoading ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin sm:size-5" aria-hidden />
                  Sending pick...
                </>
              ) : (
                "Pick this player"
              )}
            </button>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}
