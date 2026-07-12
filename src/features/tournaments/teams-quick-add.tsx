"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createTeamAction } from "@/features/tournaments/actions";
import { OwnerPicker, type AssignablePerson } from "@/features/tournaments/owner-picker";
import { ImageUploadOrUrlField } from "@/features/uploads/image-upload-or-url-field";

interface TeamsQuickAddProps {
  tournamentSlug: string;
  assignablePeople: AssignablePerson[];
  uploadsEnabled: boolean;
  variant?: "card" | "plain";
  onCreated?: () => void;
}

export function TeamsQuickAdd({
  tournamentSlug,
  assignablePeople,
  uploadsEnabled,
  variant = "card",
  onCreated,
}: TeamsQuickAddProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createTeamAction({
        tournamentSlug,
        name: String(formData.get("name") ?? ""),
        shortName: String(formData.get("shortName") ?? "").trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        colorHex: String(formData.get("colorHex") ?? "").trim() || undefined,
        ownerUserId: ownerUserId.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      setOwnerUserId("");
      setLogoUrl("");
      router.refresh();
      onCreated?.();
    } finally {
      setIsSubmitting(false);
    }
  }

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
          <Label htmlFor="team-name">Franchise name</Label>
          <Input
            id="team-name"
            name="name"
            required
            minLength={2}
            placeholder="Court Crushers"
            className="min-h-11"
          />
          <p className="text-xs text-muted-foreground">
            Use the full display name shown across fixtures, auction boards, and standings.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="short">Ticker</Label>
          <Input id="short" name="shortName" maxLength={8} placeholder="CCR" className="min-h-11" />
          <p className="text-xs text-muted-foreground">
            Short broadcast code for compact tables and live score views.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-owner">Franchise owner</Label>
          <div className="min-w-0">
            <OwnerPicker
              id="quick-owner"
              label="Franchise owner"
              hideLabel
              value={ownerUserId}
              onChange={setOwnerUserId}
              people={assignablePeople}
              className="w-full"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Optional for now. You can assign or change the owner later from the Teams table.
          </p>
        </div>
      </div>

      <details className="rounded-2xl border border-border/60 bg-background/40 px-5 py-4 text-sm">
        <summary className="cursor-pointer font-medium text-foreground outline-none">
          Branding (optional)
        </summary>
        <div className="mt-4 grid gap-5">
          <ImageUploadOrUrlField
            tournamentSlug={tournamentSlug}
            purpose="team-logo"
            label="Franchise logo"
            urlInputId="logoUrl"
            urlValue={logoUrl}
            onUrlChange={setLogoUrl}
            uploadsEnabled={uploadsEnabled}
          />
          <div className="space-y-2">
            <Label htmlFor="colorHex">Accent HEX</Label>
            <Input id="colorHex" name="colorHex" placeholder="#38bdf8" className="min-h-11" />
            <p className="text-xs text-muted-foreground">
              Optional brand color used in team cards and visual accents.
            </p>
          </div>
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
          pendingLabel="Saving…"
          className="min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
        >
          Add franchise
        </Button>
      </div>
    </form>
  );
}
