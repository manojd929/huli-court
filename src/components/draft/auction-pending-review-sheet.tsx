"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GENDER_LABEL } from "@/constants/player-labels";
import {
  assignManualPickAction,
  confirmPickAction,
  undoPickAction,
} from "@/features/draft/actions";
import { DraftPhase } from "@/generated/prisma/enums";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import type { DraftSnapshotDto } from "@/types/draft";

interface AuctionPendingReviewSheetProps {
  slug: string;
  snapshot: DraftSnapshotDto;
}

export function AuctionPendingReviewSheet({ slug, snapshot }: AuctionPendingReviewSheetProps) {
  const open =
    snapshot.draftPhase === DraftPhase.LIVE &&
    Boolean(snapshot.pendingPickPlayerId && snapshot.pendingPickTeamId);

  const pendingPlayer = useMemo(
    () =>
      snapshot.pendingPickPlayerId
        ? (snapshot.players.find((p) => p.id === snapshot.pendingPickPlayerId) ?? null)
        : null,
    [snapshot.pendingPickPlayerId, snapshot.players],
  );

  const nominatingTeam = useMemo(
    () =>
      snapshot.pendingPickTeamId
        ? (snapshot.teams.find((t) => t.id === snapshot.pendingPickTeamId) ?? null)
        : null,
    [snapshot.pendingPickTeamId, snapshot.teams],
  );

  const [manualTeamId, setManualTeamId] = useState<string>("");
  const [showOverride, setShowOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentTurnTeamId = useMemo(() => {
    const slot = snapshot.draftSlots.find((s) => s.slotIndex === snapshot.currentSlotIndex);
    return slot?.teamId ?? null;
  }, [snapshot.currentSlotIndex, snapshot.draftSlots]);

  const clockMismatch = Boolean(
    currentTurnTeamId &&
    snapshot.pendingPickTeamId &&
    currentTurnTeamId !== snapshot.pendingPickTeamId &&
    !snapshot.overrideValidation,
  );

  const manualAssignTeamTriggerLabel = useMemo(() => {
    if (!manualTeamId) {
      return null;
    }
    return snapshot.teams.find((t) => t.id === manualTeamId)?.name ?? "Franchise";
  }, [manualTeamId, snapshot.teams]);

  const run = useCallback(
    async (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
      setBusy(true);
      try {
        const result = await fn();
        if (!result.ok) {
          toast.error(result.error ?? `${label} failed`);
          return;
        }
        toast.success(label);
        setShowOverride(false);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  if (!open || !snapshot.pendingPickPlayerId || !snapshot.pendingPickTeamId) {
    return null;
  }

  const canManualAssign = manualTeamId.length > 0;

  return (
    <Sheet open modal>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92vh] gap-0 overflow-y-auto rounded-t-3xl border-t border-border bg-background/97 p-0 shadow-2xl backdrop-blur-xl sm:max-h-[85vh]"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-border/80 bg-background/95 px-4 pt-5 pb-4 backdrop-blur-md sm:px-6">
          <SheetTitle className="text-lg sm:text-xl">Nominee ready</SheetTitle>
          <SheetDescription className="text-sm">
            Confirm to add them to that franchise roster, or reject to release the nominee.
          </SheetDescription>
        </SheetHeader>

        {pendingPlayer ? (
          <div className="grid gap-5 px-4 py-5 sm:grid-cols-[minmax(0,280px)_1fr] sm:gap-8 sm:px-6 sm:py-6">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-2xl bg-muted ring-1 ring-border sm:mx-0 sm:max-w-none">
              {pendingPlayer.photoUrl ? (
                <Image
                  src={pendingPlayer.photoUrl}
                  alt={pendingPlayer.name}
                  fill
                  className="object-contain object-center"
                  sizes="280px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-semibold text-muted-foreground">
                  {pendingPlayer.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {pendingPlayer.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RosterCategoryPill
                    name={pendingPlayer.rosterCategoryName}
                    colorHex={pendingPlayer.rosterCategoryColorHex}
                    className="text-sm"
                  />
                  <Badge variant="outline" className="text-xs font-normal">
                    {GENDER_LABEL[pendingPlayer.gender]}
                  </Badge>
                  {pendingPlayer.isUnavailable ? (
                    <Badge variant="destructive" className="text-xs">
                      Not here
                    </Badge>
                  ) : null}
                  {pendingPlayer.isLocked ? (
                    <Badge variant="outline" className="text-xs">
                      Locked
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/30 px-3 py-3 text-sm">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Franchise / turn
                </span>
                <p className="mt-1 text-base font-semibold">
                  {nominatingTeam?.name ?? snapshot.pendingPickTeamId}
                  {clockMismatch ? (
                    <span className="ml-2 align-middle text-xs font-normal text-amber-700 dark:text-amber-400">
                      (Nomination does not match current clock unless you override.)
                    </span>
                  ) : null}
                </p>
              </div>

              {pendingPlayer.notes ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {pendingPlayer.notes}
                </p>
              ) : null}

              {!showOverride ? (
                <>
                  <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className="min-h-12 flex-[2] text-base font-semibold"
                      disabled={busy}
                      onClick={() =>
                        void run("Pick saved", () => confirmPickAction({ tournamentSlug: slug }))
                      }
                    >
                      Confirm pick
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 flex-1 text-base font-medium"
                      disabled={busy}
                      onClick={() =>
                        void run("Nomination cleared", () =>
                          undoPickAction({ tournamentSlug: slug }),
                        )
                      }
                    >
                      Decline nominee
                    </Button>
                  </div>
                  <details className="mt-4 rounded-xl border border-border/70 bg-muted/20">
                    <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                      Advanced · wrong franchise nominated?
                    </summary>
                    <div className="border-t border-border/60 px-3 py-3">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-10 w-full text-sm"
                        disabled={busy}
                        onClick={() => {
                          setManualTeamId(snapshot.pendingPickTeamId ?? "");
                          setShowOverride(true);
                        }}
                      >
                        Assign manually to another franchise…
                      </Button>
                    </div>
                  </details>
                </>
              ) : (
                <div className="mt-auto space-y-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
                  <p className="text-xs font-medium text-primary">
                    Manual assign skips the nominee queue; use for clock corrections while rules are
                    on (subject to squad caps).
                  </p>
                  <Select
                    value={manualTeamId || undefined}
                    onValueChange={(value) => setManualTeamId(value ?? "")}
                  >
                    <SelectTrigger className="w-full bg-background/80">
                      <SelectValue placeholder="Assign to franchise">
                        {manualAssignTeamTriggerLabel ?? undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(60vh,320px)]">
                      {snapshot.teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {manualTeamId === t.id && snapshot.pendingPickTeamId === t.id
                            ? " (nominated franchise)"
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      variant="destructive"
                      disabled={busy || !canManualAssign}
                      onClick={() =>
                        void run("Manual assign recorded", () =>
                          assignManualPickAction({
                            tournamentSlug: slug,
                            playerId: snapshot.pendingPickPlayerId!,
                            teamId: manualTeamId,
                            idempotencyKey: crypto.randomUUID(),
                          }),
                        )
                      }
                    >
                      Confirm assign to selected franchise
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 flex-1"
                      disabled={busy}
                      onClick={() => setShowOverride(false)}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-muted-foreground sm:px-6">
            Waiting for nominee details… refresh if this persists.
          </p>
        )}

        <SheetFooter className="sticky bottom-0 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md sm:px-6">
          <p className="w-full text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Shortcuts ·{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
              Enter
            </kbd>{" "}
            confirm ·{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
              Backspace
            </kbd>{" "}
            decline or undo · more in organizer{" "}
            <span className="font-medium text-foreground">Advanced</span>
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
