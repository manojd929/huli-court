"use client";

import { motion } from "framer-motion";
import Image from "next/image";

import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { cn } from "@/lib/utils";
import type { DraftPlayerDto } from "@/types/draft";

interface TvRosterPlayerTileProps {
  player: DraftPlayerDto;
  variant: "confirmed" | "pending";
}

export function TvRosterPlayerTile({ player, variant }: TvRosterPlayerTileProps) {
  const confirmed = variant === "confirmed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-md backdrop-blur-sm dark:bg-black/35 dark:shadow-[0_12px_40px_-20px_rgba(0,0,0,0.75)]",
        confirmed
          ? "border-border dark:border-white/15"
          : "border-amber-400/60 ring-2 ring-amber-400/35 dark:border-amber-400/55",
      )}
    >
      <div className="relative aspect-[5/6] w-full bg-gradient-to-b from-muted/70 to-muted/40 dark:from-white/12 dark:to-transparent">
        {player.photoUrl ? (
          <Image
            src={player.photoUrl}
            alt={`${player.name} photo`}
            fill
            className="object-contain object-center"
            sizes="(max-width: 480px) 42vw, (max-width: 768px) 28vw, 200px"
            unoptimized
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[clamp(1.65rem,4.5vw,2.65rem)] font-bold text-muted-foreground tabular-nums dark:text-white/50"
            aria-hidden
          >
            {player.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        {!confirmed ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-900/90 via-amber-700/50 to-transparent px-2 pt-8 pb-2 dark:from-amber-950/90 dark:via-amber-900/55">
            <p className="text-center text-[10px] font-semibold tracking-wider text-amber-50 uppercase">
              Pending
            </p>
          </div>
        ) : null}
      </div>
      <div className="space-y-2 border-t border-border p-3 sm:p-3.5 dark:border-white/10">
        <p className="line-clamp-2 text-center text-[clamp(0.78rem,2.85vw,0.92rem)] leading-snug font-semibold text-foreground sm:text-[clamp(0.8rem,1.05vw,0.95rem)] dark:text-white">
          {player.name}
        </p>
        <div className="flex justify-center">
          <RosterCategoryPill
            name={player.rosterCategoryName}
            colorHex={player.rosterCategoryColorHex}
            className="max-w-full text-[10px] font-medium sm:text-xs dark:border-white/25 dark:bg-white/10 dark:text-white/95"
          />
        </div>
      </div>
    </motion.div>
  );
}
