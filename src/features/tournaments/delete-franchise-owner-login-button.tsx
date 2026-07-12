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
import { deleteFranchiseOwnerAction } from "@/features/tournaments/actions";
import { ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE } from "@/lib/errors/safe-user-feedback";
import { cn } from "@/lib/utils";

interface DeleteFranchiseOwnerLoginButtonProps {
  tournamentSlug: string;
  ownerUserId: string;
  ownerLabel: string;
  invitingSupported: boolean;
  canInviteOwners: boolean;
}

export function DeleteFranchiseOwnerLoginButton({
  tournamentSlug,
  ownerUserId,
  ownerLabel,
  invitingSupported,
  canInviteOwners,
}: DeleteFranchiseOwnerLoginButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = !invitingSupported || !canInviteOwners;
  const lockedTitle = !invitingSupported
    ? ADMIN_LEAGUE_OWNER_PROVISIONING_UNAVAILABLE
    : "Owner logins cannot be changed after the draft configuration is sealed.";

  async function confirmDelete(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const result = await deleteFranchiseOwnerAction({
        tournamentSlug,
        ownerUserId,
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        title={locked ? lockedTitle : undefined}
        disabled={locked}
        className={cn(
          "min-h-9 touch-manipulation border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
          locked && "pointer-events-none opacity-50",
        )}
        onClick={() => {
          if (locked) return;
          setError(null);
          setOpen(true);
        }}
      >
        Remove login
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md" size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove franchise owner login?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Unassigns <span className="font-medium text-foreground">{ownerLabel}</span> from every
              franchise in this league, clears roster links tied to them here, and removes their
              sign-in credentials when nothing else references that account.
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
              pendingLabel="Removing…"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              Remove login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
