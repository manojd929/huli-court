"use server";

import { randomUUID } from "node:crypto";

import { Buffer } from "node:buffer";

import { put } from "@vercel/blob";

import { requireSessionUser } from "@/lib/auth/session";
import { ADMIN_IMAGE_UPLOAD_UNAVAILABLE } from "@/lib/errors/safe-user-feedback";
import { normalizeLeagueImageForBlob } from "@/lib/uploads/normalize-league-image";
import { assertTournamentOwnership, TournamentServiceError } from "@/services/tournament-service";

/** Original upload limit before server-side compression (compressed output is capped separately). */
const INPUT_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type UploadLeagueImageResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadLeagueImageAction(
  formData: FormData,
): Promise<UploadLeagueImageResult> {
  try {
    const user = await requireSessionUser();
    const tournamentSlug = String(formData.get("tournamentSlug") ?? "").trim();
    const purposeRaw = String(formData.get("purpose") ?? "").trim();
    const file = formData.get("file");

    if (
      purposeRaw !== "team-logo" &&
      purposeRaw !== "player-photo" &&
      purposeRaw !== "tournament-logo"
    ) {
      return { ok: false, error: "Invalid upload type." };
    }
    const purpose = purposeRaw;

    if (!tournamentSlug) {
      return { ok: false, error: "Missing tournament." };
    }

    await assertTournamentOwnership(tournamentSlug, user.id);

    if (!(file instanceof File)) {
      return { ok: false, error: "Choose an image file." };
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return { ok: false, error: "Use JPG, PNG, WebP, or GIF." };
    }

    if (file.size > INPUT_MAX_BYTES) {
      return { ok: false, error: "Image must be 15 MB or smaller before upload." };
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      return {
        ok: false,
        error: ADMIN_IMAGE_UPLOAD_UNAVAILABLE,
      };
    }

    const pathname = `draftforge/${tournamentSlug}/${purpose}/${randomUUID()}.webp`;
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    const normalized = await normalizeLeagueImageForBlob(rawBuffer);
    if (!normalized.ok) {
      if (normalized.reason === "still_too_large") {
        return {
          ok: false,
          error: "That image could not be compressed under 2.5 MB. Try a smaller or simpler image.",
        };
      }
      return {
        ok: false,
        error: "Could not read that image. Use JPG, PNG, WebP, or GIF.",
      };
    }

    const blob = await put(pathname, normalized.buffer, {
      access: "public",
      token,
      addRandomSuffix: false,
      contentType: "image/webp",
    });

    return { ok: true, url: blob.url };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return { ok: false, error: "Unauthorized" };
    }
    if (e instanceof TournamentServiceError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Upload failed. Try again or paste a URL." };
  }
}
