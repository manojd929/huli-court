"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DraftPhase } from "@/generated/prisma/enums";
import type { DraftOrderSlotDto, DraftTeamDto } from "@/types/draft";

function slotsSignature(slots: DraftOrderSlotDto[]): string {
  return [...slots]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((s) => `${s.slotIndex}:${s.teamId}`)
    .join("|");
}

/** First snake round: first N slots where N = number of franchises. */
function firstRoundTeamIds(slots: DraftOrderSlotDto[]): string[] {
  const sorted = [...slots].sort((a, b) => a.slotIndex - b.slotIndex);
  if (sorted.length === 0) return [];
  const franchiseCount = new Set(sorted.map((s) => s.teamId)).size;
  return sorted.slice(0, franchiseCount).map((s) => s.teamId);
}

function shuffleIds(ids: string[]): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j]!;
    copy[j] = swap!;
  }
  return copy;
}

interface DraftOrderRevealOverlayProps {
  slug: string;
  draftPhase: DraftPhase;
  draftSlots: DraftOrderSlotDto[];
  teams: DraftTeamDto[];
}

export function DraftOrderRevealOverlay({
  slug,
  draftPhase,
  draftSlots,
  teams,
}: DraftOrderRevealOverlayProps) {
  const teamsById = useMemo(() => {
    const map: Record<string, DraftTeamDto> = {};
    for (const t of teams) {
      map[t.id] = t;
    }
    return map;
  }, [teams]);

  const sig = useMemo(() => slotsSignature(draftSlots), [draftSlots]);

  const firstRoundIds = useMemo(() => firstRoundTeamIds(draftSlots), [draftSlots]);

  const storageKey = `draft-order-reveal:${slug}:${sig}`;

  /** Live snapshot polls replace `draftSlots` with a new array often; sync here so the auto-open effect can read latest slots without depending on array identity. */
  const draftSlotsRef = useRef(draftSlots);
  useEffect(() => {
    draftSlotsRef.current = draftSlots;
  }, [draftSlots]);

  const eligible =
    draftSlots.length > 0 &&
    firstRoundIds.length > 0 &&
    (draftPhase === DraftPhase.READY || draftPhase === DraftPhase.SETUP);

  const [open, setOpen] = useState(false);
  const [moment, setMoment] = useState<"spin" | "reveal">("spin");
  const [spinTick, setSpinTick] = useState(0);
  const [spinDeck, setSpinDeck] = useState<string[]>([]);

  useEffect(() => {
    if (!eligible || typeof window === "undefined") return;
    if (sessionStorage.getItem(storageKey) === "1") return;

    const roundIds = firstRoundTeamIds(draftSlotsRef.current);
    if (roundIds.length === 0) return;

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      setSpinDeck(shuffleIds(roundIds));
      setMoment("spin");
      setSpinTick(0);
      setOpen(true);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
    // Intentionally omit `draftSlots` / `firstRoundIds` identity: polling refreshes arrays without changing `sig`.
  }, [eligible, storageKey, sig]);

  const dismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, "1");
    }
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!open || moment !== "spin") return;
    const spinMs = 2400;
    const toReveal = setTimeout(() => setMoment("reveal"), spinMs);
    return () => clearTimeout(toReveal);
  }, [open, moment]);

  useEffect(() => {
    if (!open || moment !== "spin" || firstRoundIds.length === 0) return;
    const id = setInterval(() => {
      setSpinTick((t) => t + 1);
    }, 82);
    return () => clearInterval(id);
  }, [open, moment, firstRoundIds.length]);

  const spinningTeamId =
    spinDeck.length > 0 ? spinDeck[spinTick % spinDeck.length]! : firstRoundIds[0]!;
  const spinningLabel =
    teamsById[spinningTeamId]?.name ?? teamsById[firstRoundIds[0]!]?.name ?? "…";

  if (!eligible) {
    return null;
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="draft-order-reveal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-order-reveal-title"
          aria-describedby="draft-order-reveal-desc"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-background via-background/96 to-primary/[0.07] p-4 backdrop-blur-md sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute top-1/4 -left-1/4 size-72 rounded-full bg-amber-400/15 blur-3xl"
              animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -right-1/4 bottom-1/4 size-80 rounded-full bg-primary/20 blur-3xl"
              animate={{ opacity: [0.25, 0.45, 0.25], scale: [1.05, 1, 1.05] }}
              transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <div className="relative z-10 max-w-lg space-y-3 text-center">
            <p className="text-xs font-semibold tracking-[0.22em] text-amber-600/90 uppercase dark:text-amber-400/90">
              Round 1 · pick order
            </p>
            <h2
              id="draft-order-reveal-title"
              className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              Draw your spot in line
            </h2>
            <p
              id="draft-order-reveal-desc"
              className="text-sm leading-relaxed text-muted-foreground sm:text-base"
            >
              Order below was randomly set for owners, like a quick lottery before the auction. Your
              snake rounds still reverse each pass.
            </p>
          </div>

          <div className="relative z-10 flex min-h-[14rem] w-full max-w-md flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {moment === "spin" ? (
                <motion.div
                  key="spin"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-4"
                >
                  <motion.p
                    className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                    animate={{ opacity: [0.65, 1, 0.65] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    Spinning the hat…
                  </motion.p>
                  <motion.div
                    key={spinningLabel}
                    initial={{ opacity: 0.4, y: 10, rotateX: -12 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-8 py-6 text-center shadow-lg shadow-amber-900/10 dark:bg-amber-950/40 dark:shadow-black/40"
                  >
                    <p className="text-lg font-semibold text-foreground sm:text-xl">
                      {spinningLabel}
                    </p>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.ol
                  key="reveal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.12, delayChildren: 0.08 }}
                  className="w-full space-y-3"
                >
                  {firstRoundIds.map((teamId, index) => {
                    const name = teamsById[teamId]?.name ?? "Franchise";
                    return (
                      <motion.li
                        key={teamId}
                        initial={{ opacity: 0, x: -28 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                        className="flex items-center gap-4 rounded-xl border border-border/80 bg-card/60 px-4 py-3 text-left shadow-sm backdrop-blur-sm"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                          {name}
                        </span>
                      </motion.li>
                    );
                  })}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
            {moment === "spin" ? (
              <Button type="button" variant="outline" onClick={dismiss}>
                Skip intro
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Button type="button" className="min-h-11 px-8" onClick={dismiss}>
                  Enter auction board
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
