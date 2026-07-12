"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { randomizeDraftOrderAction } from "@/features/draft/actions";
import { cn } from "@/lib/utils";

export interface RandomDraftOrderTeam {
  id: string;
  name: string;
}

interface RandomDraftOrderShuffleProps {
  tournamentSlug: string;
  teams: RandomDraftOrderTeam[];
  finalOrderTeamIds?: string[];
  isFirstShuffle?: boolean;
  className?: string;
  /**
   * When false, shuffle is unavailable (auction started, order locked). Still requires teams client-side.
   */
  allowShuffle?: boolean;
  /** Shown when `allowShuffle` is false (tooltip / accessibility). Ignored while teams array is empty. */
  unavailableReason?: string;
}

function shuffleTeams(list: RandomDraftOrderTeam[]): RandomDraftOrderTeam[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function RandomDraftOrderShuffle({
  tournamentSlug,
  teams,
  finalOrderTeamIds = [],
  isFirstShuffle = false,
  className,
  allowShuffle = true,
  unavailableReason = "Shuffle is unavailable right now.",
}: RandomDraftOrderShuffleProps) {
  const [shuffling, setShuffling] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<RandomDraftOrderTeam[]>([]);
  const [animationStage, setAnimationStage] = useState<"shuffle" | "reveal">("shuffle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const teamsSnapshotRef = useRef<RandomDraftOrderTeam[]>(teams);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!shuffling) return;
    const base = teamsSnapshotRef.current;
    if (base.length === 0) return;
    intervalRef.current = setInterval(() => {
      setDisplayOrder((prev) => shuffleTeams(prev.length > 0 ? prev : base));
    }, 88);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [shuffling]);

  const run = useCallback(async () => {
    if (teams.length === 0) {
      toast.error("Add at least one team before shuffling order.");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    teamsSnapshotRef.current = teams;
    setAnimationStage("shuffle");
    setDisplayOrder(shuffleTeams(teams));
    setShuffling(true);
    try {
      const minimumOverlayMs = isFirstShuffle ? 3000 : 1950;
      const sequenceStartedAt = Date.now();
      await new Promise((resolve) => setTimeout(resolve, isFirstShuffle ? 2100 : minimumOverlayMs));
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const result = await randomizeDraftOrderAction({ tournamentSlug });
      if (!result.ok) {
        toast.error(result.error ?? "Could not randomize.");
        return;
      }
      if (isFirstShuffle) {
        setAnimationStage("reveal");
        const elapsed = Date.now() - sequenceStartedAt;
        const holdMs = Math.max(420, minimumOverlayMs - elapsed);
        await new Promise((resolve) => setTimeout(resolve, holdMs));
      }
      toast.success("Pick order updated.");
    } finally {
      busyRef.current = false;
      setShuffling(false);
      setAnimationStage("shuffle");
    }
  }, [isFirstShuffle, teams, tournamentSlug]);

  const empty = teams.length === 0;
  const blockedByFlow = !allowShuffle;
  const disabled = empty || blockedByFlow;
  const orderedRevealChips =
    finalOrderTeamIds.length > 0
      ? finalOrderTeamIds
          .map((teamId) => teams.find((team) => team.id === teamId))
          .filter((team): team is RandomDraftOrderTeam => Boolean(team))
      : teams;
  const chips =
    shuffling && animationStage === "shuffle"
      ? displayOrder
      : animationStage === "reveal"
        ? orderedRevealChips
        : teams;

  const disabledTitle = empty
    ? "Add at least one franchise before shuffling."
    : blockedByFlow
      ? unavailableReason
      : undefined;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        pending={shuffling}
        pendingLabel="Shuffling…"
        aria-busy={shuffling}
        title={disabledTitle}
        className={cn("min-h-11 text-sm sm:text-xs sm:tracking-wide sm:uppercase", className)}
        onClick={() => void run()}
      >
        Shuffle pick order
      </Button>
      {shuffling ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/90 p-4 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Shuffling pick order"
        >
          <div className="space-y-2 text-center">
            <motion.p
              className="text-lg font-semibold tracking-tight sm:text-xl"
              animate={{ opacity: [1, 0.72, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            >
              {animationStage === "shuffle" ? "Shuffling teams…" : "Final draft order"}
            </motion.p>
            <p className="max-w-md text-sm text-muted-foreground">
              {animationStage === "shuffle"
                ? "Hang on. Building a new random pick order for the auction."
                : "The lottery is complete. Here is the order for round one."}
            </p>
          </div>

          {chips.length > 0 ? (
            <motion.div
              layout
              className="flex max-h-[45vh] max-w-[min(100%,28rem)] flex-wrap justify-center gap-2 overflow-y-auto px-1"
            >
              {chips.map((team, index) => (
                <motion.span
                  key={team.id}
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 520,
                    damping: 34,
                  }}
                  className="inline-flex max-w-[12rem] items-center gap-2 truncate rounded-full border border-primary/35 bg-primary/10 px-3 py-2 text-center text-sm font-medium text-foreground shadow-sm sm:max-w-[13rem]"
                >
                  {animationStage === "reveal" ? (
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold">
                      {index + 1}
                    </span>
                  ) : null}
                  {team.name}
                </motion.span>
              ))}
            </motion.div>
          ) : null}

          {animationStage === "shuffle" ? (
            <motion.div
              className="flex gap-2"
              aria-hidden
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            >
              <span className="size-2 rounded-full bg-primary/80" />
              <span className="size-2 rounded-full bg-primary/50" />
              <span className="size-2 rounded-full bg-primary/30" />
            </motion.div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
