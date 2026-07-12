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
import { updateTeamAction } from "@/features/tournaments/actions";
import type { TeamEditSnapshot } from "@/features/tournaments/team-edit-dialog";
import { cn } from "@/lib/utils";

interface RemoveTeamOwnerButtonProps {
  tournamentSlug: string;
  team: TeamEditSnapshot;
  className?: string;
}

export function RemoveTeamOwnerButton({
  tournamentSlug,
  team,
  className,
}: RemoveTeamOwnerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasOwner = Boolean(team.ownerUserId?.trim());

  async function confirmRemove(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const result = await updateTeamAction({
        tournamentSlug,
        teamId: team.id,
        name: team.name,
        shortName: team.shortName ?? "",
        logoUrl: team.logoUrl ?? "",
        colorHex: team.colorHex ?? "",
        ownerUserId: "",
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

  if (!hasOwner) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-8 min-h-8 w-full touch-manipulation border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:min-w-[5.5rem] sm:px-3",
          className,
        )}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Remove owner
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md" size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove franchise owner?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              <span className="font-medium text-foreground">{team.name}</span> will have no owner
              login until you assign someone again. Sync clears auto-created roster stubs when
              needed. If someone only had login access through their roster stub here (and no other
              franchises rely on them), their sign-in credentials are cleared automatically when it
              is safe to do so.
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
                void confirmRemove();
              }}
            >
              Remove owner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
