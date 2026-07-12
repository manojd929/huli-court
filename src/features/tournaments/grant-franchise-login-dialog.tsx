"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeagueOwnerForPlayerAction } from "@/features/tournaments/actions";
import { ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE } from "@/lib/errors/safe-user-feedback";

interface GrantFranchiseLoginDialogProps {
  tournamentSlug: string;
  playerId: string;
  playerName: string;
  invitingSupported: boolean;
  canInviteOwners: boolean;
  className?: string;
}

export function GrantFranchiseLoginDialog({
  tournamentSlug,
  playerId,
  playerName,
  invitingSupported,
  canInviteOwners,
  className,
}: GrantFranchiseLoginDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locked = !invitingSupported || !canInviteOwners;
  const lockedTitle = !invitingSupported
    ? ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE
    : "Owner logins cannot be changed after the draft configuration is sealed.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setDoneMessage(null);
    setIsSubmitting(true);
    try {
      const result = await createLeagueOwnerForPlayerAction({
        tournamentSlug,
        playerId,
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
          ? `${result.email ?? "That account"} already had a HuliCourt login, so we linked it here instead of creating a new one. The password you entered was not used; they sign in with their existing password. Now assign their franchise on Teams.`
          : `Created login for ${result.email ?? "that account"}. Share email and password with them, then assign their franchise on Teams.`,
      );
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className ?? "min-h-11 touch-manipulation sm:min-h-8"}
        disabled={locked}
        title={locked ? lockedTitle : undefined}
        onClick={() => {
          if (locked) return;
          setError(null);
          setDoneMessage(null);
          setOpen(true);
        }}
      >
        Grant login
      </Button>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Grant franchise owner login</DialogTitle>
          <DialogDescription>
            Creates an email and password login for{" "}
            <span className="font-medium text-foreground">{playerName}</span>. After this, assign
            them to a team from Teams if you have not already.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 py-2" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor={`grant-email-${playerId}`}>Email</Label>
            <Input
              id={`grant-email-${playerId}`}
              name="email"
              type="email"
              autoComplete="off"
              required
              placeholder="owner@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`grant-password-${playerId}`}>Temporary password</Label>
            <Input
              id={`grant-password-${playerId}`}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Min 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`grant-display-${playerId}`}>Display name (optional)</Label>
            <Input
              id={`grant-display-${playerId}`}
              name="displayName"
              placeholder={playerName}
              defaultValue={playerName}
            />
          </div>
          {doneMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {doneMessage}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Close
            </DialogClose>
            <Button type="submit" pending={isSubmitting} pendingLabel="Creating…">
              Create login
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
