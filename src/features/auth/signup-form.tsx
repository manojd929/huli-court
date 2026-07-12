"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/constants/app";
import { signUpAction } from "@/features/auth/signup-actions";
import {
  authSessionFinalizeUserMessage,
  networkOrUnknownSignInUserMessage,
  SIGN_IN_NOT_CONFIGURED,
} from "@/lib/errors/safe-user-feedback";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function SignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!isSupabaseConfigured()) {
      setMessage(SIGN_IN_NOT_CONFIGURED);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUpAction({
        displayName,
        email,
        password,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      // Account exists — sign straight in with the same credentials.
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session?.access_token || !data.session.refresh_token) {
        setMessage("Your league was created. Sign in with your new credentials.");
        return;
      }

      const finalizeRes = await fetch(ROUTES.apiAuthEstablishSession, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });
      const finalizePayload: unknown = await finalizeRes.json().catch(() => null);
      const syncOk =
        finalizePayload !== null &&
        typeof finalizePayload === "object" &&
        "ok" in finalizePayload &&
        (finalizePayload as { ok?: unknown }).ok === true;
      if (!finalizeRes.ok || !syncOk) {
        setMessage(authSessionFinalizeUserMessage());
        return;
      }

      window.location.assign(ROUTES.dashboard);
    } catch (err) {
      setMessage(networkOrUnknownSignInUserMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5 rounded-2xl border border-border/70 bg-card/95 px-6 py-6 text-card-foreground shadow-lg backdrop-blur-xl sm:px-7 sm:py-7 dark:border-white/12 dark:bg-neutral-900/95">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Start your league</h1>
        <p className="text-sm leading-relaxed text-foreground/72 sm:text-base dark:text-foreground/80">
          Free snake drafts and random team assignment, live boards for the projector, and fixtures
          through to the final. Create your organizer account to run your first tournament.
        </p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => void handleSubmit(event)}
        data-testid="signup-form"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-display-name">Your name</Label>
          <Input
            id="signup-display-name"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            minLength={2}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>
        {message ? (
          <p className="text-sm leading-snug text-destructive" role="alert">
            {message}
          </p>
        ) : null}
        <Button
          type="submit"
          pending={isSubmitting}
          pendingLabel="Creating your league…"
          className="min-h-12 w-full text-base"
        >
          Create my league
        </Button>
      </form>

      <p className="border-t border-border/50 pt-4 text-center text-sm leading-snug text-foreground/72 dark:text-foreground/78">
        Already organizing here?{" "}
        <a className="font-medium text-foreground underline" href="/login">
          Sign in
        </a>
      </p>
    </div>
  );
}
