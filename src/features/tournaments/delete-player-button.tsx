"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2Icon } from "lucide-react";

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
import { deletePlayerAction } from "@/features/tournaments/actions";
import { cn } from "@/lib/utils";

interface DeletePlayerButtonProps {
  tournamentSlug: string;
  playerId: string;
  playerName: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  compact?: boolean;
}

export function DeletePlayerButton({
  tournamentSlug,
  playerId,
  playerName,
  disabled = false,
  disabledReason,
  className,
  compact = false,
}: DeletePlayerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const result = await deletePlayerAction({ tournamentSlug, playerId });
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
        title={disabled ? disabledReason : undefined}
        aria-label={compact ? `Delete ${playerName}` : undefined}
        size={compact ? "icon-sm" : undefined}
        className={cn(
          compact
            ? "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            : "min-h-11 w-full touch-manipulation border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:min-w-[7rem]",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setError(null);
          setOpen(true);
        }}
      >
        {compact ? <Trash2Icon className="size-4" aria-hidden /> : "Delete"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md" size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove player?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Permanently remove <span className="font-medium text-foreground">{playerName}</span>{" "}
              from this auction roster (only when they have no picks on record).
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
              pendingLabel="Deleting…"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              Delete player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
