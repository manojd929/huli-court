"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeagueOwnerAction } from "@/features/tournaments/actions";
import { ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE } from "@/lib/errors/safe-user-feedback";
import { cn } from "@/lib/utils";

interface InviteOwnerPanelProps {
  tournamentSlug: string;
  invitingSupported: boolean;
  canInviteOwners: boolean;
  variant?: "card" | "plain";
  onCreated?: () => void;
}

export function InviteOwnerPanel({
  tournamentSlug,
  invitingSupported,
  canInviteOwners,
  variant = "card",
  onCreated,
}: InviteOwnerPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setDoneMessage(null);
    setIsSubmitting(true);
    try {
      const result = await createLeagueOwnerAction({
        tournamentSlug,
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        displayName: String(formData.get("displayName") ?? "").trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      setDoneMessage(
        result.linkedExisting
          ? `${result.email ?? "That account"} already had a HuliCourt login, so we linked it here instead of creating a new one. The password you entered was not used; they sign in with their existing password. Assign a franchise to them from Teams.`
          : `Created login for ${result.email ?? "that account"}. Prefer adding roster rows on Players first next time; you can still assign a franchise when you close this panel.`,
      );
      router.refresh();
      onCreated?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  const cardFrame = variant === "card";

  if (!invitingSupported) {
    return (
      <div
        className={cn(
          "text-sm",
          cardFrame && "rounded-xl border border-amber-500/40 bg-amber-500/5 p-5",
        )}
      >
        <p className="font-medium text-foreground">Owner invites need administrator setup</p>
        <p className="mt-2 text-muted-foreground">{ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        cardFrame
          ? "rounded-xl border border-border/70 bg-card/40 p-6 backdrop-blur-md"
          : "space-y-4",
      )}
    >
      <h3 className="text-lg font-semibold tracking-tight">
        Optional: owner login without a roster row
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Preferred flow is Players → add the person → Grant login → Teams → assign franchise. Use
        this form only when you want a standalone franchise-owner login first.
      </p>
      {!canInviteOwners ? (
        <p className="mt-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Franchise owner logins cannot be created while this tournament is sealed for drafting.
        </p>
      ) : (
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              placeholder="owner@example.com"
            />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="invite-password">Temporary password</Label>
            <Input
              id="invite-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Min 8 characters"
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="invite-name">Display name (optional)</Label>
            <Input id="invite-name" name="displayName" placeholder="Priya K." />
          </div>
          <div className="flex sm:col-span-2 lg:col-span-1">
            <Button
              type="submit"
              pending={isSubmitting}
              pendingLabel="Creating…"
              className="w-full lg:w-auto"
            >
              Create owner
            </Button>
          </div>
        </form>
      )}
      {doneMessage ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {doneMessage}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
