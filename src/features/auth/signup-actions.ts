"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createOrganizationWithOwner,
  OrganizationServiceError,
} from "@/services/organization-service";

const signUpSchema = z.object({
  displayName: z.string().min(2).max(80),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export type SignUpResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Self-serve organizer signup: creates a confirmed auth user (service role),
 * an ADMIN profile, and a default workspace/organization (auto-named from the
 * user — renameable later once the league name is surfaced in the UI). The
 * client signs in with the same credentials immediately afterwards.
 */
export async function signUpAction(input: unknown): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Check your details — your name needs 2+ characters and a password of 8+.",
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !serviceKey?.trim()) {
    return {
      ok: false,
      error: "Sign-up is not configured on this deployment yet.",
    };
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = parsed.data.email.trim().toLowerCase();
  const displayName = parsed.data.displayName.trim();

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (error || !data.user) {
    const message = error?.message ?? "";
    return {
      ok: false,
      error: /already|exists|registered/iu.test(message)
        ? "An account with this email already exists — sign in instead."
        : "Could not create your account. Try again.",
    };
  }

  try {
    await prisma.userProfile.upsert({
      where: { id: data.user.id },
      create: {
        id: data.user.id,
        email,
        displayName,
        role: UserRole.ADMIN,
      },
      update: { email, displayName, role: UserRole.ADMIN },
    });
    // Auto-name the default workspace from the user; renameable later.
    await createOrganizationWithOwner({
      userId: data.user.id,
      name: `${displayName}'s League`,
    });
  } catch (err) {
    // Roll back the orphaned auth user so the email can retry cleanly.
    await adminClient.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    if (err instanceof OrganizationServiceError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Could not finish setting up your league. Try again." };
  }

  return { ok: true };
}
