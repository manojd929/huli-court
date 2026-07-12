import type { SupabaseClient } from "@supabase/supabase-js";

import { syncUserProfile } from "@/lib/auth/profile";
import { authSessionFinalizeUserMessage } from "@/lib/errors/safe-user-feedback";

export type FinalizePasswordSessionResult = { ok: true } | { ok: false; error: string };

export async function finalizePasswordLoginSessionWithClient(
  supabase: SupabaseClient,
  accessToken: string,
  refreshToken: string,
): Promise<FinalizePasswordSessionResult> {
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    return {
      ok: false,
      error: authSessionFinalizeUserMessage(),
    };
  }
  const user = data.user ?? data.session?.user;
  if (!user) {
    return { ok: false, error: "Sign-in incomplete. Try again." };
  }
  try {
    await syncUserProfile(user);
  } catch {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "This login is not allowed for this portal.",
    };
  }
  return { ok: true };
}
