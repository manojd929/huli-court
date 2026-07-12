import { z } from "zod";

export const updateMatchStateSchema = z.object({
  tournamentSlug: z.string().min(1),
  matchId: z.string().uuid(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  sideOneScore: z.coerce.number().int().min(0).nullable().optional(),
  sideTwoScore: z.coerce.number().int().min(0).nullable().optional(),
});

export const toggleEntityEliminationSchema = z.object({
  tournamentSlug: z.string().min(1),
  entityId: z.string().uuid(),
  eliminated: z.boolean(),
});

export type UpdateMatchStateInput = z.infer<typeof updateMatchStateSchema>;
export type ToggleEntityEliminationInput = z.infer<typeof toggleEntityEliminationSchema>;
