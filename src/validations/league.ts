import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/u)
  .optional()
  .or(z.literal(""));

export const createLeagueSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  colorHex: hexColor,
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;

export const updateLeagueSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(2000).optional(),
    logoUrl: z.string().url().optional().or(z.literal("")),
    colorHex: hexColor,
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.description !== undefined ||
      d.logoUrl !== undefined ||
      d.colorHex !== undefined,
    { message: "Nothing to update.", path: ["slug"] },
  );

export type UpdateLeagueInput = z.infer<typeof updateLeagueSchema>;
