"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { revokeFranchiseLoginFromPlayerAction } from "@/features/tournaments/actions";
import { cn } from "@/lib/utils";

interface RevokeFranchiseLoginButtonProps {
  tournamentSlug: string;
  playerId: string;
  playerName: string;
  canInviteOwners: boolean;
  className?: string;
}

export function RevokeFranchiseLoginButton({
  tournamentSlug,
  playerId,
  playerName,
  canInviteOwners,
  className,
}: RevokeFranchiseLoginButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmRevoke(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const result = await revokeFranchiseLoginFromPlayerAction({
        tournamentSlug,
        playerId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const lockedTitle = "Owner logins cannot be changed after the draft configuration is sealed.";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        title={!canInviteOwners ? lockedTitle : undefined}
        disabled={!canInviteOwners}
        className={cn(
          "min-h-11 touch-manipulation border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-8",
          !canInviteOwners && "pointer-events-none opacity-50",
          className,
        )}
        onClick={() => {
          if (!canInviteOwners) return;
          setError(null);
          setOpen(true);
        }}
      >
        Revoke login
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md" size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke franchise login?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Removes sign-in credentials for{" "}
              <span className="font-medium text-foreground">{playerName}</span> when they are not
              assigned to a franchise on Teams. If they still control a team, remove them there
              first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              className="min-h-11 touch-manipulation"
              pending={busy}
              pendingLabel="Revoking…"
              onClick={(event) => {
                event.preventDefault();
                void confirmRevoke();
              }}
            >
              Revoke login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
