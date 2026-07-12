"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { updateTeamAction } from "@/features/tournaments/actions";
import { OwnerPicker, type AssignablePerson } from "@/features/tournaments/owner-picker";
import type { TeamEditSnapshot } from "@/features/tournaments/team-edit-dialog";

interface TeamOwnerEditDialogProps {
  tournamentSlug: string;
  team: TeamEditSnapshot;
  assignablePeople: AssignablePerson[];
}

export function TeamOwnerEditDialog({
  tournamentSlug,
  team,
  assignablePeople,
}: TeamOwnerEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState(team.ownerUserId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openDialog(): void {
    setOwnerUserId(team.ownerUserId ?? "");
    setError(null);
    setOpen(true);
  }

  async function handleSave(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await updateTeamAction({
        tournamentSlug,
        teamId: team.id,
        name: team.name,
        shortName: team.shortName ?? "",
        logoUrl: team.logoUrl ?? "",
        colorHex: team.colorHex ?? "",
        ownerUserId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        type="button"
        className="h-8 min-h-8 touch-manipulation px-3 text-xs sm:h-8 sm:min-h-8"
        onClick={openDialog}
      >
        {team.ownerUserId?.trim() ? "Change owner" : "Assign owner"}
      </Button>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Franchise owner · {team.name}</DialogTitle>
          <DialogDescription>
            Pick who logs in as this franchise during the auction. Their roster slot appears on the
            Players page: change category or photo there, same as everyone else.
          </DialogDescription>
        </DialogHeader>
        <div className="py-1">
          <OwnerPicker
            id={`team-owner-quick-${team.id}`}
            label="Owner login"
            value={ownerUserId}
            onChange={setOwnerUserId}
            people={assignablePeople}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
          <DialogClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            pending={isSubmitting}
            pendingLabel="Saving…"
            onClick={() => void handleSave()}
          >
            Save owner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
