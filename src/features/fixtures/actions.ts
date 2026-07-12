"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { TournamentServiceError } from "@/services/tournament-service";
import {
  assignTieMatchParticipants,
  createFixtureTie,
  createSinglesMatch,
  createTieMatch,
  deleteFixtureMatch,
  deleteFixtureTie,
  generateRoundRobinTies,
} from "@/services/fixtures-service";
import {
  assignTieMatchParticipantsSchema,
  createFixtureTieSchema,
  createSinglesMatchSchema,
  createTieMatchSchema,
  deleteFixtureMatchSchema,
  deleteFixtureTieSchema,
  generateRoundRobinTiesSchema,
} from "@/validations/fixtures";

type ActionResult = { ok: true } | { ok: false; error: string };

function handle(err: unknown): ActionResult {
  if (err instanceof TournamentServiceError) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error. Try again." };
}

export async function generateRoundRobinTiesAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = generateRoundRobinTiesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const user = await requireSessionUser();
    await generateRoundRobinTies({ actorUserId: user.id, ...parsed.data });
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/fixtures`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/run`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/leaderboard`);
    return { ok: true };
  } catch (error) {
    return handle(error);
  }
}

export async function createSinglesMatchAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = createSinglesMatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const user = await requireSessionUser();
    await createSinglesMatch({ actorUserId: user.id, ...parsed.data });
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/fixtures`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/run`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/leaderboard`);
    return { ok: true };
  } catch (error) {
    return handle(error);
  }
}

export async function createFixtureTieAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = createFixtureTieSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const user = await requireSessionUser();
    await createFixtureTie({ actorUserId: user.id, ...parsed.data });
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/fixtures`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/run`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/leaderboard`);
    return { ok: true };
  } catch (error) {
    return handle(error);
  }
}

export async function createTieMatchAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = createTieMatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const user = await requireSessionUser();
    await createTieMatch({ actorUserId: user.id, ...parsed.data });
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/fixtures`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/run`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/leaderboard`);
    return { ok: true };
  } catch (error) {
    return handle(error);
  }
}

export async function assignTieMatchParticipantsAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = assignTieMatchParticipantsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const user = await requireSessionUser();
    await assignTieMatchParticipants({ actorUserId: user.id, ...parsed.data });
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/fixtures`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/run`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/leaderboard`);
    return { ok: true };
  } catch (error) {
    return handle(error);
  }
}

export async function deleteFixtureTieAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = deleteFixtureTieSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const user = await requireSessionUser();
    await deleteFixtureTie({ actorUserId: user.id, ...parsed.data });
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/fixtures`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/run`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/leaderboard`);
    return { ok: true };
  } catch (error) {
    return handle(error);
  }
}

export async function deleteFixtureMatchAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = deleteFixtureMatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const user = await requireSessionUser();
    await deleteFixtureMatch({ actorUserId: user.id, ...parsed.data });
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/fixtures`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/run`);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}/leaderboard`);
    return { ok: true };
  } catch (error) {
    return handle(error);
  }
}
