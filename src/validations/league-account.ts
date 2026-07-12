import { z } from "zod";

export const createLeagueOwnerSchema = z.object({
  tournamentSlug: z.string().min(1),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().max(120).optional().or(z.literal("")),
});

export type CreateLeagueOwnerInput = z.infer<typeof createLeagueOwnerSchema>;

export const createLeagueOwnerForPlayerSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().max(120).optional().or(z.literal("")),
});

export type CreateLeagueOwnerForPlayerInput = z.infer<typeof createLeagueOwnerForPlayerSchema>;

export const deleteFranchiseOwnerSchema = z.object({
  tournamentSlug: z.string().min(1),
  ownerUserId: z.string().uuid(),
});

export type DeleteFranchiseOwnerInput = z.infer<typeof deleteFranchiseOwnerSchema>;

export const revokeFranchiseLoginFromPlayerSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
});

export type RevokeFranchiseLoginFromPlayerInput = z.infer<
  typeof revokeFranchiseLoginFromPlayerSchema
>;
