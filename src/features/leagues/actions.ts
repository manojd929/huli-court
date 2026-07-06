"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createLeague,
  LeagueServiceError,
  updateLeague,
} from "@/services/league-service";
import { createLeagueSchema, updateLeagueSchema } from "@/validations/league";

export type LeagueActionResult =
  | { ok: true; slug?: string }
  | { ok: false; error: string };

function handle(err: unknown): LeagueActionResult {
  if (err instanceof LeagueServiceError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof Error && err.message === "Unauthorized") {
    return { ok: false, error: "Unauthorized" };
  }
  console.error("[league-action] unexpected error:", err);
  return { ok: false, error: "Unexpected error. Try again." };
}

export async function createLeagueAction(
  input: unknown,
): Promise<LeagueActionResult> {
  try {
    const parsed = createLeagueSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid league details." };
    const user = await requireSessionUser();
    const profile = await prisma.userProfile.findFirst({
      where: { id: user.id, deletedAt: null },
      select: { role: true },
    });
    if (!profile || profile.role !== UserRole.ADMIN) {
      return { ok: false, error: "Only organizers can create leagues." };
    }
    const { slug } = await createLeague(user.id, {
      name: parsed.data.name,
      description: parsed.data.description,
      logoUrl: parsed.data.logoUrl,
      colorHex: parsed.data.colorHex,
    });
    revalidatePath("/dashboard");
    return { ok: true, slug };
  } catch (e) {
    return handle(e);
  }
}

export async function updateLeagueAction(
  input: unknown,
): Promise<LeagueActionResult> {
  try {
    const parsed = updateLeagueSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid league details." };
    const user = await requireSessionUser();
    await updateLeague(user.id, parsed.data);
    revalidatePath(`/league/${parsed.data.slug}`);
    revalidatePath("/dashboard");
    return { ok: true, slug: parsed.data.slug };
  } catch (e) {
    return handle(e);
  }
}
