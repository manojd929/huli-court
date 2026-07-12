import { DraftPhase } from "@/generated/prisma/enums";

interface DraftProgressSnapshot {
  draftPhase: DraftPhase;
  currentSlotIndex: number;
  draftSlotsTotal: number;
  picksCount: number;
}

export interface DraftProgressDisplay {
  currentPickOrdinal: number;
  displayPickCount: number;
  progressPercent: number;
}

/**
 * Keeps auction progress consistent across screens.
 * Once an auction is marked completed, the UI should always show a full board.
 */
export function getDraftProgressDisplay(snapshot: DraftProgressSnapshot): DraftProgressDisplay {
  if (snapshot.draftSlotsTotal <= 0) {
    return {
      currentPickOrdinal: 0,
      displayPickCount: 0,
      progressPercent: 0,
    };
  }

  const displayPickCount =
    snapshot.draftPhase === DraftPhase.COMPLETED
      ? snapshot.draftSlotsTotal
      : Math.min(
          Math.max(
            snapshot.picksCount,
            Math.min(Math.max(snapshot.currentSlotIndex + 1, 1), snapshot.draftSlotsTotal),
          ),
          snapshot.draftSlotsTotal,
        );
  const currentPickOrdinal =
    snapshot.draftPhase === DraftPhase.COMPLETED
      ? snapshot.draftSlotsTotal
      : Math.min(Math.max(snapshot.currentSlotIndex + 1, 1), snapshot.draftSlotsTotal);

  return {
    currentPickOrdinal,
    displayPickCount,
    progressPercent: Math.min(100, Math.round((displayPickCount / snapshot.draftSlotsTotal) * 100)),
  };
}
