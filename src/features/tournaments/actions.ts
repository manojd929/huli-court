"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createLeagueOwnerAccount,
  createLeagueOwnerForPlayerAccount,
} from "@/services/league-account-service";
import {
  assertTournamentOwnership,
  bulkUpdatePlayers,
  createPlayer,
  createTeam,
  createTournament,
  deleteFranchiseOwnerFromTournament,
  reconcileSquadRulesForTournament,
  revokeFranchiseLoginFromPlayer,
  saveSquadRules,
  softDeletePlayer,
  softDeleteTournament,
  TournamentServiceError,
  updatePlayer,
  updateTeam,
  updateTournament,
} from "@/services/tournament-service";
import {
  createLeagueOwnerForPlayerSchema,
  createLeagueOwnerSchema,
  deleteFranchiseOwnerSchema,
  revokeFranchiseLoginFromPlayerSchema,
} from "@/validations/league-account";
import {
  bulkUpdatePlayersSchema,
  createPlayerSchema,
  createTeamSchema,
  createTournamentSchema,
  deletePlayerSchema,
  deleteTournamentSchema,
  draftActionSlugSchema,
  squadRulesSchema,
  updatePlayerSchema,
  updateTeamSchema,
  updateTournamentSchema,
} from "@/validations/tournament";
import {
  archiveRosterCategorySchema,
  createRosterCategorySchema,
  moveRosterCategoryOrderSchema,
  restoreRosterCategorySchema,
  updateRosterCategorySchema,
} from "@/validations/roster-category";

import {
  archiveRosterCategory,
  createRosterCategory,
  moveRosterCategoryDisplayOrder,
  restoreRosterCategory,
  updateRosterCategory,
} from "@/services/roster-category-service";

export type TournamentActionResult =
  | { ok: true; slug?: string; email?: string; linkedExisting?: boolean }
  | { ok: false; error: string };

function handle(err: unknown): TournamentActionResult {
  if (err instanceof TournamentServiceError) {
    return { ok: false, error: err.message };
  }
  // No error tracker yet — at least keep the stack in server logs so prod
  // failures are diagnosable instead of vanishing behind a generic message.
  console.error("[tournament-action] unexpected error:", err);
  return { ok: false, error: "Unexpected error. Try again." };
}

function revalidateRosterGroupDependentPaths(slug: string): void {
  revalidatePath(`/tournament/${slug}`, "layout");
  revalidatePath(`/tournament/${slug}/categories`);
  revalidatePath(`/tournament/${slug}/players`);
  revalidatePath(`/tournament/${slug}/rules`);
  revalidatePath(`/tournament/${slug}/draft`);
  revalidatePath(`/tournament/${slug}/admin`);
  revalidatePath(`/tournament/${slug}/teams`);
}

export async function updateTournamentAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = updateTournamentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament details." };
    const user = await requireSessionUser();
    await updateTournament(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath("/dashboard");
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createTournamentAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = createTournamentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament details." };
    const user = await requireSessionUser();
    const profile = await prisma.userProfile.findFirst({
      where: { id: user.id, deletedAt: null },
      select: { role: true },
    });
    if (!profile || profile.role !== UserRole.ADMIN) {
      return { ok: false, error: "Only admins can create tournaments." };
    }
    const { slug, leagueSlug } = await createTournament(user.id, parsed.data);
    revalidatePath("/dashboard");
    if (leagueSlug) revalidatePath(`/league/${leagueSlug}`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createTeamAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = createTeamSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid team details." };
    const user = await requireSessionUser();
    await createTeam(user.id, parsed.data);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}`, "layout");
    return { ok: true, slug: parsed.data.tournamentSlug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function updateTeamAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = updateTeamSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid team details." };
    const user = await requireSessionUser();
    await updateTeam(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/players`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function deleteTournamentAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = deleteTournamentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament." };
    const user = await requireSessionUser();
    await softDeleteTournament(user.id, parsed.data.tournamentSlug);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function deletePlayerAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = deletePlayerSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid player." };
    const user = await requireSessionUser();
    await softDeletePlayer(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/players`);
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/rules`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createPlayerAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = createPlayerSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid player details." };
    const user = await requireSessionUser();
    await createPlayer(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/players`);
    revalidatePath(`/tournament/${slug}/categories`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function updatePlayerAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = updatePlayerSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid player details." };
    const user = await requireSessionUser();
    await updatePlayer(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/players`);
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/rules`);
    revalidatePath(`/tournament/${slug}/categories`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function bulkUpdatePlayersAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = bulkUpdatePlayersSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid bulk player update." };
    const user = await requireSessionUser();
    await bulkUpdatePlayers(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/players`);
    revalidatePath(`/tournament/${slug}/categories`);
    revalidatePath(`/tournament/${slug}/rules`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function syncSquadRulesToRosterAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = draftActionSlugSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid tournament." };
    const user = await requireSessionUser();
    const tournamentId = await assertTournamentOwnership(parsed.data.tournamentSlug, user.id);
    await reconcileSquadRulesForTournament(tournamentId);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/rules`);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function saveSquadRulesAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = squadRulesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid squad rules." };
    const user = await requireSessionUser();
    await saveSquadRules(user.id, parsed.data);
    revalidatePath(`/tournament/${parsed.data.tournamentSlug}`, "layout");
    return { ok: true, slug: parsed.data.tournamentSlug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createLeagueOwnerAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = createLeagueOwnerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Use a valid email and password (at least 8 characters)." };
    }
    const user = await requireSessionUser();
    const { email, linkedExisting } = await createLeagueOwnerAccount(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/players`);
    return { ok: true, email, linkedExisting };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createLeagueOwnerForPlayerAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = createLeagueOwnerForPlayerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Use a valid email and password (at least 8 characters).",
      };
    }
    const user = await requireSessionUser();
    const { email, linkedExisting } = await createLeagueOwnerForPlayerAccount(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/players`);
    return { ok: true, email, linkedExisting };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function deleteFranchiseOwnerAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = deleteFranchiseOwnerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid owner selection." };
    }
    const user = await requireSessionUser();
    await deleteFranchiseOwnerFromTournament(
      user.id,
      parsed.data.tournamentSlug,
      parsed.data.ownerUserId,
    );
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/players`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function revokeFranchiseLoginFromPlayerAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = revokeFranchiseLoginFromPlayerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid player." };
    }
    const user = await requireSessionUser();
    await revokeFranchiseLoginFromPlayer(user.id, parsed.data.tournamentSlug, parsed.data.playerId);
    const slug = parsed.data.tournamentSlug;
    revalidatePath(`/tournament/${slug}`, "layout");
    revalidatePath(`/tournament/${slug}/teams`);
    revalidatePath(`/tournament/${slug}/players`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function createRosterCategoryAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = createRosterCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid roster group." };
    }
    const user = await requireSessionUser();
    await createRosterCategory(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidateRosterGroupDependentPaths(slug);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function updateRosterCategoryAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = updateRosterCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid roster group." };
    }
    const user = await requireSessionUser();
    await updateRosterCategory(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidateRosterGroupDependentPaths(slug);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function archiveRosterCategoryAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = archiveRosterCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid roster group." };
    }
    const user = await requireSessionUser();
    await archiveRosterCategory(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidateRosterGroupDependentPaths(slug);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function restoreRosterCategoryAction(input: unknown): Promise<TournamentActionResult> {
  try {
    const parsed = restoreRosterCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid roster group." };
    }
    const user = await requireSessionUser();
    await restoreRosterCategory(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidateRosterGroupDependentPaths(slug);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}

export async function moveRosterCategoryOrderAction(
  input: unknown,
): Promise<TournamentActionResult> {
  try {
    const parsed = moveRosterCategoryOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid roster reorder request." };
    }
    const user = await requireSessionUser();
    await moveRosterCategoryDisplayOrder(user.id, parsed.data);
    const slug = parsed.data.tournamentSlug;
    revalidateRosterGroupDependentPaths(slug);
    return { ok: true, slug };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    return handle(e);
  }
}
