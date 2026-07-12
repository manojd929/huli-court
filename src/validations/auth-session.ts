import { z } from "zod";

/** Payload from Supabase password sign-in; used only to hydrate server-side cookies immediately. */
export const passwordLoginSessionTokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

export type PasswordLoginSessionTokens = z.infer<typeof passwordLoginSessionTokensSchema>;
