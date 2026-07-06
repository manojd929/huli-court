"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PencilLineIcon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/app";
import { updatePlayerAction } from "@/features/tournaments/actions";
import type { RosterCategorySelectOption } from "@/features/tournaments/players-quick-add";
import { ImageUploadOrUrlField } from "@/features/uploads/image-upload-or-url-field";

export interface PlayerEditSnapshot {
  id: string;
  name: string;
  rosterCategoryId: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  photoUrl: string | null;
  notes: string | null;
  hasPaidEntryFee: boolean;
  /** Auction base price in points; omit/null when the tournament default applies. */
  basePrice?: number | null;
}

interface PlayerEditDialogProps {
  tournamentSlug: string;
  player: PlayerEditSnapshot;
  uploadsEnabled: boolean;
  selectableCategories: RosterCategorySelectOption[];
  compactTrigger?: boolean;
  className?: string;
}

export function PlayerEditDialog({
  tournamentSlug,
  player,
  uploadsEnabled,
  selectableCategories,
  compactTrigger = false,
  className,
}: PlayerEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(player.name);
  const [rosterCategoryId, setRosterCategoryId] = useState(player.rosterCategoryId);
  const [gender, setGender] = useState(player.gender);
  const [photoUrl, setPhotoUrl] = useState(player.photoUrl ?? "");
  const [notes, setNotes] = useState(player.notes ?? "");
  const [hasPaidEntryFee, setHasPaidEntryFee] = useState(player.hasPaidEntryFee);
  const [basePriceInput, setBasePriceInput] = useState(
    player.basePrice != null ? String(player.basePrice) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openDialog(): void {
    setName(player.name);
    setRosterCategoryId(player.rosterCategoryId);
    setGender(player.gender);
    setPhotoUrl(player.photoUrl ?? "");
    setNotes(player.notes ?? "");
    setHasPaidEntryFee(player.hasPaidEntryFee);
    setBasePriceInput(player.basePrice != null ? String(player.basePrice) : "");
    setError(null);
    setOpen(true);
  }

  async function handleSave(): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await updatePlayerAction({
        tournamentSlug,
        playerId: player.id,
        name: name.trim(),
        photoUrl: photoUrl.trim() || undefined,
        rosterCategoryId,
        gender,
        notes: notes.trim() || undefined,
        hasPaidEntryFee,
        basePrice:
          basePriceInput.trim() === "" ? null : Number(basePriceInput.trim()),
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

  const selectClass =
    "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        type="button"
        size={compactTrigger ? "icon-sm" : undefined}
        className={
          compactTrigger
            ? className
            : `h-8 min-h-8 px-3 text-xs touch-manipulation sm:h-8 sm:min-h-8 ${className ?? ""}`
        }
        aria-label={compactTrigger ? `Edit ${player.name}` : undefined}
        title={compactTrigger ? `Edit ${player.name}` : undefined}
        onClick={openDialog}
      >
        {compactTrigger ? <PencilLineIcon className="size-4" aria-hidden /> : "Edit player"}
      </Button>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit player</DialogTitle>
          <DialogDescription>
            Update core roster details here. Changing group refreshes pick-limit math on the rules
            page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[min(70vh,560px)] gap-5 overflow-y-auto py-1 pr-1">
          <div className="space-y-5 rounded-2xl border border-border/65 bg-card/35 p-5 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor={`player-name-${player.id}`}>Athlete name</Label>
              <Input
                id={`player-name-${player.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={1}
                maxLength={120}
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">
                This is the display name used across the auction desk, team pages, and live views.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`player-category-${player.id}`}>Roster group</Label>
              {selectableCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add roster groups first on{" "}
                  <Link
                    href={ROUTES.categories(tournamentSlug)}
                    className="font-medium underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Categories
                  </Link>
                  .
                </p>
              ) : (
                <select
                  id={`player-category-${player.id}`}
                  value={rosterCategoryId}
                  onChange={(event) => setRosterCategoryId(event.target.value)}
                  className={selectClass}
                >
                  {selectableCategories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                Switching groups updates where this player counts in roster rules and limits.
              </p>
            </div>
          </div>

          <details className="rounded-2xl border border-border/60 bg-background/40 px-5 py-4 text-sm">
            <summary className="cursor-pointer font-medium text-foreground outline-none">
              Profile and payment
            </summary>
            <div className="mt-4 grid gap-5">
              <div className="space-y-2">
                <Label htmlFor={`player-gender-${player.id}`}>Gender marker</Label>
                <select
                  id={`player-gender-${player.id}`}
                  value={gender}
                  onChange={(event) =>
                    setGender(event.target.value as PlayerEditSnapshot["gender"])
                  }
                  className={selectClass}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <ImageUploadOrUrlField
                tournamentSlug={tournamentSlug}
                purpose="player-photo"
                label="Photo"
                urlInputId={`player-photo-${player.id}`}
                urlValue={photoUrl}
                onUrlChange={setPhotoUrl}
                uploadsEnabled={uploadsEnabled}
              />
              <div className="space-y-2">
                <Label htmlFor={`player-notes-${player.id}`}>Notes</Label>
                <Textarea
                  id={`player-notes-${player.id}`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Playing style, doubles preference…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`player-base-price-${player.id}`}>
                  Auction base price{" "}
                  <span className="font-normal text-muted-foreground">
                    (points, optional)
                  </span>
                </Label>
                <Input
                  id={`player-base-price-${player.id}`}
                  type="number"
                  min={0}
                  max={1_000_000}
                  inputMode="numeric"
                  value={basePriceInput}
                  onChange={(event) => setBasePriceInput(event.target.value)}
                  placeholder="Tournament default"
                />
                <p className="text-xs text-muted-foreground">
                  Only used in live-auction tournaments. Blank falls back to the
                  tournament&apos;s default base price.
                </p>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/20 px-4 py-3">
                <input
                  type="checkbox"
                  checked={hasPaidEntryFee}
                  onChange={(event) => setHasPaidEntryFee(event.target.checked)}
                  className="mt-1 size-4 cursor-pointer rounded border-input"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">
                    Entry fee paid
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Keep this on for payment tracking only. Players can still exist before payment.
                  </span>
                </span>
              </label>
            </div>
          </details>
        </div>
        {error ? (
          <p className="whitespace-pre-wrap text-sm text-destructive" role="alert">
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
            disabled={selectableCategories.length === 0}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
