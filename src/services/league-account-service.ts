import { createClient } from "@supabase/supabase-js";

import { DraftPhase, UserRole } from "@/generated/prisma/enums";
import {
  ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE,
  leagueOwnerAdminProvisioningUserMessage,
} from "@/lib/errors/safe-user-feedback";
import { prisma } from "@/lib/prisma";

import { assertTournamentOwnership, TournamentServiceError } from "@/services/tournament-service";

import type {
  CreateLeagueOwnerForPlayerInput,
  CreateLeagueOwnerInput,
} from "@/validations/league-account";

export async function createLeagueOwnerAccount(
  commissionerUserId: string,
  input: CreateLeagueOwnerInput,
): Promise<{ userId: string; email: string; linkedExisting: boolean }> {
  const tournamentId = await assertTournamentOwnership(input.tournamentSlug, commissionerUserId);

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId },
    select: { draftPhase: true },
  });
  if (!tournament) {
    throw new TournamentServiceError("Tournament not found.");
  }
  if (tournament.draftPhase !== DraftPhase.SETUP && tournament.draftPhase !== DraftPhase.READY) {
    throw new TournamentServiceError(
      "Cannot create franchise owner logins after the draft configuration is sealed.",
    );
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  // A real person plausibly owns franchises across more than one commissioner's
  // tournament (different leagues, same player). Rather than failing outright
  // when the email already has an account elsewhere, link that existing login
  // to this tournament instead of trying (and failing) to create a duplicate.
  // We never touch the password of an existing account here.
  const existingProfile = await prisma.userProfile.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
      deletedAt: null,
    },
    select: { id: true, email: true, role: true },
  });

  if (existingProfile) {
    if (existingProfile.id === commissionerUserId) {
      throw new TournamentServiceError(
        "That is your own commissioner login. Franchise owners need a separate account.",
      );
    }
    if (existingProfile.role === UserRole.ADMIN) {
      throw new TournamentServiceError(
        "That email belongs to a commissioner/admin account and cannot be granted a franchise-owner login.",
      );
    }
    if (existingProfile.role !== UserRole.OWNER) {
      await prisma.userProfile.update({
        where: { id: existingProfile.id },
        data: { role: UserRole.OWNER },
      });
    }
    return {
      userId: existingProfile.id,
      email: existingProfile.email,
      linkedExisting: true,
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.trim() || !serviceKey?.trim()) {
    throw new TournamentServiceError(ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE);
  }

  const adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const displayTrimmed = input.displayName?.trim() ?? "";

  const { data, error } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
    user_metadata:
      displayTrimmed !== ""
        ? {
            full_name: displayTrimmed,
          }
        : undefined,
  });

  if (error) {
    throw new TournamentServiceError(leagueOwnerAdminProvisioningUserMessage(error.message));
  }

  const authUser = data.user;
  if (!authUser) {
    throw new TournamentServiceError("Could not create that login.");
  }

  const resolvedEmail = authUser.email ?? normalizedEmail;

  await prisma.userProfile.upsert({
    where: { id: authUser.id },
    create: {
      id: authUser.id,
      email: resolvedEmail,
      displayName: displayTrimmed !== "" ? displayTrimmed : null,
      role: UserRole.OWNER,
    },
    update: {
      email: resolvedEmail,
      role: UserRole.OWNER,
      ...(displayTrimmed !== "" ? { displayName: displayTrimmed } : {}),
    },
  });

  return { userId: authUser.id, email: resolvedEmail, linkedExisting: false };
}

export async function createLeagueOwnerForPlayerAccount(
  commissionerUserId: string,
  input: CreateLeagueOwnerForPlayerInput,
): Promise<{ email: string; linkedExisting: boolean }> {
  const tournamentId = await assertTournamentOwnership(input.tournamentSlug, commissionerUserId);

  const player = await prisma.player.findFirst({
    where: {
      id: input.playerId,
      tournamentId,
      deletedAt: null,
    },
    select: { id: true, linkedOwnerUserId: true, name: true },
  });

  if (!player) {
    throw new TournamentServiceError("Player not found.");
  }

  if (player.linkedOwnerUserId !== null) {
    throw new TournamentServiceError("This roster row already has a franchise login.");
  }

  const displayTrimmed = input.displayName?.trim() ?? "";
  const displayForInvite = displayTrimmed !== "" ? displayTrimmed : player.name.trim();

  const { userId, email, linkedExisting } = await createLeagueOwnerAccount(commissionerUserId, {
    tournamentSlug: input.tournamentSlug,
    email: input.email,
    password: input.password,
    displayName: displayForInvite,
  });

  if (linkedExisting) {
    const alreadyLinkedInTournament = await prisma.player.findFirst({
      where: {
        tournamentId,
        deletedAt: null,
        linkedOwnerUserId: userId,
      },
      select: { id: true },
    });
    if (alreadyLinkedInTournament) {
      throw new TournamentServiceError(
        "That account already has a franchise login in this tournament. Assign it from Teams instead of granting a new one.",
      );
    }
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { linkedOwnerUserId: userId },
  });

  return { email, linkedExisting };
}

export function isLeagueOwnerInviteConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
