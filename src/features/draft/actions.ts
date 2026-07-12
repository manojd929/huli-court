"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth/session";
import {
  assignManualPick,
  confirmPick,
  DraftServiceError,
  endDraft,
  forceSyncLog,
  freezeDraft,
  lockDraft,
  markPlayerLocked,
  markPlayerUnavailable,
  nextTurn,
  pauseDraft,
  previousTurn,
  randomizeDraftOrder,
  requestPick,
  resumeDraft,
  setAuctionSpotlightCategory,
  skipTurn,
  startDraft,
  toggleOverrideValidation,
  undoLastPick,
  unlockDraft,
} from "@/services/draft-service";
import { runRandomAssignment } from "@/services/allocation-service";
import { closeAuctionLot, openAuctionLot, placeAuctionBid } from "@/services/auction-service";
import {
  assignManualSchema,
  auctionSpotlightSchema,
  closeAuctionLotSchema,
  confirmPickSchema,
  draftActionSlugSchema,
  openAuctionLotSchema,
  pickRequestSchema,
  placeAuctionBidSchema,
  playerIdSlugSchema,
  runRandomAssignmentSchema,
} from "@/validations/tournament";

const zToggle = z.object({
  tournamentSlug: z.string().min(1),
  enabled: z.boolean(),
});

const zMarkAvail = playerIdSlugSchema.extend({
  unavailable: z.boolean(),
});

const zMarkLocked = playerIdSlugSchema.extend({
  locked: z.boolean(),
});

function revalidateTournament(slug: string) {
  revalidatePath(`/tournament/${slug}`, "layout");
}

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function handle(err: unknown): { ok: false; error: string } {
  if (err instanceof DraftServiceError) {
    return { ok: false, error: err.message };
  }
  return { ok: false, error: "Unexpected error. Try again." };
}

function unauthorized(): { ok: false; error: string } {
  return { ok: false, error: "Unauthorized" };
}

export async function randomizeDraftOrderAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await randomizeDraftOrder({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function startDraftAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await startDraft({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function pauseDraftAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await pauseDraft({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function resumeDraftAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await resumeDraft({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function setAuctionSpotlightCategoryAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = auctionSpotlightSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    const raw = parsed.data.rosterCategoryId.trim();
    const rosterCategoryId = raw === "" || raw === "OPEN" ? null : raw;

    await setAuctionSpotlightCategory({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      rosterCategoryId,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function freezeDraftAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await freezeDraft({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function unlockDraftAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await unlockDraft({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function lockDraftAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await lockDraft({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function endDraftAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await endDraft({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function nextTurnAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await nextTurn({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function previousTurnAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await previousTurn({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function skipTurnAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await skipTurn({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function requestPickAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = pickRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await requestPick({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      playerId: parsed.data.playerId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function confirmPickAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = confirmPickSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await confirmPick({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function undoPickAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await undoLastPick({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function toggleOverrideValidationAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = zToggle.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await toggleOverrideValidation({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      enabled: parsed.data.enabled,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function forceSyncAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await forceSyncLog({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function assignManualPickAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = assignManualSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await assignManualPick({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      playerId: parsed.data.playerId,
      teamId: parsed.data.teamId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function runRandomAssignmentAction(
  input: unknown,
): Promise<ActionResult<{ assignedCount: number; unassignedCount: number }>> {
  try {
    const parsed = runRandomAssignmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    const result = await runRandomAssignment({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true, data: result };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function openAuctionLotAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = openAuctionLotSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await openAuctionLot({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      playerId: parsed.data.playerId,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function placeAuctionBidAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = placeAuctionBidSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await placeAuctionBid({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      lotId: parsed.data.lotId,
      amount: parsed.data.amount,
      expectedBidCount: parsed.data.expectedBidCount,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function closeAuctionLotAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = closeAuctionLotSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await closeAuctionLot({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      lotId: parsed.data.lotId,
      outcome: parsed.data.outcome,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function markPlayerUnavailableAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = zMarkAvail.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await markPlayerUnavailable({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      playerId: parsed.data.playerId,
      unavailable: parsed.data.unavailable,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}

export async function markPlayerLockedAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = zMarkLocked.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid payload." };
    const user = await requireSessionUser();
    await markPlayerLocked({
      tournamentSlug: parsed.data.tournamentSlug,
      actorUserId: user.id,
      playerId: parsed.data.playerId,
      locked: parsed.data.locked,
    });
    revalidateTournament(parsed.data.tournamentSlug);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return unauthorized();
    }
    return handle(e);
  }
}
