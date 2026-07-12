"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/constants/app";

import {
  authPasswordSignInUserMessage,
  authSessionFinalizeUserMessage,
  networkOrUnknownSignInUserMessage,
  SIGN_IN_NOT_CONFIGURED,
} from "@/lib/errors/safe-user-feedback";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface LoginFormProps {
  /** Server-sanitized post-sign-in redirect to avoid suspense/search-params hydration churn. */
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
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
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(authPasswordSignInUserMessage(error.message));
        return;
      }

      const session = data.session;
      if (!session?.access_token || !session.refresh_token) {
        setMessage("Sign-in did not return a session. Try again.");
        return;
      }

      const finalizeRes = await fetch(ROUTES.apiAuthEstablishSession, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
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

      /* Full navigation avoids stale client state after auth cookies are set (router.push alone can leave /login visible). */
      window.location.assign(nextPath);
    } catch (err) {
      setMessage(networkOrUnknownSignInUserMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5 rounded-2xl border border-border/70 bg-card/95 px-6 py-6 text-card-foreground shadow-lg backdrop-blur-xl sm:px-7 sm:py-7 dark:border-white/12 dark:bg-neutral-900/95">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Sign in</h1>
        <p className="text-sm leading-relaxed text-foreground/72 sm:text-base dark:text-foreground/80">
          League organizers and franchise owners use the email and password the commissioner gave
          you. During the auction, franchise owners should open the{" "}
          <span className="font-medium text-foreground">Owner</span> screen after signing in. The
          same login works every week.
        </p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => void handleSubmit(event)}
        data-testid="login-form"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-foreground">
            Email
          </Label>
          <Input
            id="email"
            data-testid="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-foreground">
            Password
          </Label>
          <Input
            id="password"
            data-testid="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3">
          {message ? (
            <p className="text-sm leading-snug text-destructive" role="alert">
              {message}
            </p>
          ) : null}
          <Button
            type="submit"
            data-testid="login-submit"
            pending={isSubmitting}
            pendingLabel="Signing in…"
            className="min-h-12 w-full text-base"
          >
            Sign in
          </Button>
        </div>
      </form>

      <p className="border-t border-border/50 pt-4 text-center text-sm leading-snug text-foreground/72 md:leading-relaxed dark:text-foreground/78">
        New franchise owner? Your commissioner creates your login from{" "}
        <span className="font-medium text-foreground">Teams</span>. Forgot password? Ask them to
        reset or re-invite you. Starting your own league?{" "}
        <a className="font-medium text-foreground underline" href="/signup">
          Create an organizer account
        </a>
        .
      </p>
    </div>
  );
}
