import { z } from "zod";

export const allocationMethodSchema = z.enum([
  "SNAKE_DRAFT",
  "RANDOM_ASSIGNMENT",
  "LIVE_AUCTION",
]);

export const sportSchema = z.enum([
  "BADMINTON",
  "PICKLEBALL",
  "TENNIS",
  "TABLE_TENNIS",
  "SQUASH",
  "PADEL",
  "OTHER",
]);

export const createTournamentSchema = z.object({
  name: z.string().min(2).max(120),
  sport: sportSchema.optional(),
  /** Optional league to file this tournament under; blank = standalone. */
  leagueId: z.string().uuid().optional().or(z.literal("")),
  season: z.string().max(40).optional(),
  tournamentFormat: z.enum(["DOUBLES_ONLY", "MIXED", "SINGLES_ONLY"]).optional(),
  allocationMethod: allocationMethodSchema.optional(),
  /** Auction economy in whole points; only used when allocationMethod is LIVE_AUCTION. */
  auctionPurse: z.coerce.number().int().min(100).max(100_000_000).optional(),
  auctionMinIncrement: z.coerce.number().int().min(1).max(1_000_000).optional(),
  auctionDefaultBasePrice: z.coerce.number().int().min(0).max(1_000_000).optional(),
  description: z.string().max(2000).optional(),
  picksPerTeam: z.number().int().min(1).max(50).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/u)
    .optional()
    .or(z.literal("")),
  /** Whole rupees; stored as INR minor units. */
  playerEntryFeeRupeesWhole: z.coerce.number().int().min(0).max(5_000_000).optional(),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = z
  .object({
    tournamentSlug: z.string().min(1),
    name: z.string().min(2).max(120).optional(),
    logoUrl: z.string().url().optional().or(z.literal("")),
    colorHex: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/u)
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.logoUrl !== undefined ||
      data.colorHex !== undefined,
    { message: "Nothing to update.", path: ["tournamentSlug"] },
  );

export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;

export const createTeamSchema = z.object({
  tournamentSlug: z.string().min(1),
  name: z.string().min(2).max(80),
  shortName: z.string().max(8).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/u)
    .optional()
    .or(z.literal("")),
  ownerUserId: z
    .string()
    .max(36)
    .optional()
    .refine(
      (s) =>
        s === undefined ||
        s.trim() === "" ||
        z.string().uuid().safeParse(s.trim()).success,
      { message: "Owner ID must be blank or a valid UUID." },
    ),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  tournamentSlug: z.string().min(1),
  teamId: z.string().uuid(),
  name: z.string().min(2).max(80),
  shortName: z.string().max(8).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/u)
    .optional()
    .or(z.literal("")),
  ownerUserId: z
    .string()
    .max(36)
    .refine(
      (s) =>
        s.trim() === "" || z.string().uuid().safeParse(s.trim()).success,
      { message: "Owner ID must be blank or a valid UUID." },
    ),
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const createPlayerSchema = z.object({
  tournamentSlug: z.string().min(1),
  name: z.string().min(1).max(120),
  photoUrl: z.string().url().optional().or(z.literal("")),
  rosterCategoryId: z.string().uuid(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  notes: z.string().max(500).optional(),
  hasPaidEntryFee: z.boolean().optional(),
  /** Auction base price in points; null clears back to the tournament default. */
  basePrice: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

export const updatePlayerSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
  name: z.string().min(1).max(120),
  photoUrl: z.string().url().optional().or(z.literal("")),
  rosterCategoryId: z.string().uuid(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  notes: z.string().max(500).optional(),
  hasPaidEntryFee: z.boolean().optional(),
  /** Auction base price in points; null clears back to the tournament default. */
  basePrice: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

export const bulkUpdatePlayersSchema = z
  .object({
    tournamentSlug: z.string().min(1),
    playerIds: z.array(z.string().uuid()).min(1),
    rosterCategoryId: z.string().uuid().optional(),
    hasPaidEntryFee: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.rosterCategoryId !== undefined || data.hasPaidEntryFee !== undefined,
    { message: "Choose at least one bulk change.", path: ["playerIds"] },
  );

export type BulkUpdatePlayersInput = z.infer<typeof bulkUpdatePlayersSchema>;

export const deleteTournamentSchema = z.object({
  tournamentSlug: z.string().min(1),
});

export type DeleteTournamentInput = z.infer<typeof deleteTournamentSchema>;

export const deletePlayerSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
});

export type DeletePlayerInput = z.infer<typeof deletePlayerSchema>;

export const squadRulesSchema = z.object({
  tournamentSlug: z.string().min(1),
  rules: z
    .array(
      z.object({
        rosterCategoryId: z.string().uuid(),
        maxCount: z.coerce.number().int().min(0).max(50),
      }),
    )
    .min(1),
});

export type SquadRulesInput = z.infer<typeof squadRulesSchema>;

export const draftActionSlugSchema = z.object({
  tournamentSlug: z.string().min(1),
});

export const pickRequestSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const confirmPickSchema = z.object({
  tournamentSlug: z.string().min(1),
});

export const assignManualSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

/** `OPEN` clears the LIVE roster-group spotlight (owners see all categories again). */
export const auctionSpotlightSchema = z.object({
  tournamentSlug: z.string().min(1),
  rosterCategoryId: z.union([
    z.string().uuid(),
    z.literal("OPEN"),
    z.literal(""),
  ]),
});

export const playerIdSlugSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
});

export const runRandomAssignmentSchema = z.object({
  tournamentSlug: z.string().min(1),
});

export const openAuctionLotSchema = z.object({
  tournamentSlug: z.string().min(1),
  playerId: z.string().uuid(),
});

export const placeAuctionBidSchema = z.object({
  tournamentSlug: z.string().min(1),
  lotId: z.string().uuid(),
  amount: z.number().int().min(0),
  /** bidCount the bidder saw; the bid only lands if the lot is unchanged. */
  expectedBidCount: z.number().int().min(0),
});

export const closeAuctionLotSchema = z.object({
  tournamentSlug: z.string().min(1),
  lotId: z.string().uuid(),
  outcome: z.enum(["SOLD", "UNSOLD", "CANCELLED"]),
});
