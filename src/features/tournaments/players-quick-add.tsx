"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPlayerAction } from "@/features/tournaments/actions";
import { ImageUploadOrUrlField } from "@/features/uploads/image-upload-or-url-field";
import { cn } from "@/lib/utils";

export interface RosterCategorySelectOption {
  id: string;
  name: string;
}

interface PlayersQuickAddProps {
  tournamentSlug: string;
  uploadsEnabled: boolean;
  selectableCategories: RosterCategorySelectOption[];
  defaultRosterCategoryId: string;
  /** Default `card` embeds bordered panel used on legacy pages; `plain` strips chrome for drawers. */
  variant?: "card" | "plain";
  onCreated?: () => void;
}

export function PlayersQuickAdd({
  tournamentSlug,
  uploadsEnabled,
  selectableCategories,
  defaultRosterCategoryId,
  variant = "card",
  onCreated,
}: PlayersQuickAddProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [rosterCategoryId, setRosterCategoryId] = useState(defaultRosterCategoryId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const gender = String(formData.get("gender") ?? "");
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createPlayerAction({
        tournamentSlug,
        name: String(formData.get("name") ?? ""),
        photoUrl: photoUrl.trim() || undefined,
        rosterCategoryId,
        gender: gender as "MALE" | "FEMALE" | "OTHER",
        notes: String(formData.get("notes") ?? "").trim() || undefined,
        hasPaidEntryFee: formData.get("hasPaidEntryFee") === "on",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      setPhotoUrl("");
      setRosterCategoryId(defaultRosterCategoryId);
      router.refresh();
      onCreated?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectClass =
    "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <form
      className={cn(
        "grid gap-5",
        variant === "card" && "rounded-xl border border-border/70 bg-card/40 p-6 backdrop-blur-md",
      )}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="space-y-5 rounded-2xl border border-border/65 bg-card/35 p-5 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="player-name">Athlete name</Label>
          <Input
            id="player-name"
            name="name"
            required
            minLength={1}
            maxLength={120}
            placeholder="Alex Morgan"
            className="min-h-11"
          />
          <p className="text-xs text-muted-foreground">
            Use the display name you want on the auction desk, owner roster, and broadcast views.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="roster-category">Roster group</Label>
          <select
            id="roster-category"
            name="rosterCategoryId"
            value={rosterCategoryId}
            onChange={(event) => setRosterCategoryId(event.target.value)}
            className={selectClass}
          >
            {selectableCategories.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Pick the roster bucket this player should count against during draft rules and limits.
          </p>
        </div>
      </div>

      <details className="rounded-2xl border border-border/60 bg-background/40 px-5 py-4 text-sm">
        <summary className="cursor-pointer font-medium text-foreground outline-none">
          Profile and payment (optional)
        </summary>
        <div className="mt-4 grid gap-5">
          <div className="space-y-2">
            <Label htmlFor="gender">Gender marker</Label>
            <select id="gender" name="gender" defaultValue="MALE" className={selectClass}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <ImageUploadOrUrlField
            tournamentSlug={tournamentSlug}
            purpose="player-photo"
            label="Photo"
            urlInputId="photoUrl"
            urlValue={photoUrl}
            onUrlChange={setPhotoUrl}
            uploadsEnabled={uploadsEnabled}
          />

          <div className="space-y-2">
            <Label htmlFor="player-notes">Notes</Label>
            <Textarea
              id="player-notes"
              name="notes"
              rows={3}
              maxLength={500}
              placeholder="Playing style, doubles preference…"
            />
            <p className="text-xs text-muted-foreground">
              Add scouting or pairing context your commissioner desk may want during nominations.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/30 px-4 py-3">
            <input
              id="player-entry-fee-paid"
              name="hasPaidEntryFee"
              type="checkbox"
              className="mt-1 size-4 cursor-pointer rounded border-input"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">Entry fee paid</span>
              <span className="block text-sm text-muted-foreground">
                Track payment here without blocking player creation.
              </span>
            </span>
          </label>
        </div>
      </details>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end border-t border-border/60 pt-2">
        <Button
          type="submit"
          pending={isSubmitting}
          pendingLabel="Adding…"
          className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
        >
          Add player
        </Button>
      </div>
    </form>
  );
}
