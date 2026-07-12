"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/constants/app";
import { updateTournamentAction } from "@/features/tournaments/actions";
import { cn } from "@/lib/utils";
import { ImageUploadOrUrlField } from "@/features/uploads/image-upload-or-url-field";

interface TournamentBrandingFormProps {
  tournamentSlug: string;
  initialName: string;
  initialLogoUrl: string | null;
  initialColorHex: string | null;
  uploadsEnabled: boolean;
}

export function TournamentBrandingForm({
  tournamentSlug,
  initialName,
  initialLogoUrl,
  initialColorHex,
  uploadsEnabled,
}: TournamentBrandingFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const colorValue = initialColorHex?.match(/^#[0-9A-Fa-f]{6}$/u) ? initialColorHex : "#38bdf8";

  return (
    <section className="rounded-xl border border-border/80 bg-card/40 p-4 backdrop-blur-md sm:p-6">
      <h3 className="text-lg font-semibold tracking-tight">Tournament name & look</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Logo and color appear at the top of every tournament page. Owners still get their own team
        logos on the auction board.
      </p>
      <form
        className="mt-6 flex flex-col gap-5"
        action={(formData) => {
          startTransition(async () => {
            setError(null);
            const name = String(formData.get("name") ?? "").trim();
            const colorHexRaw = String(formData.get("colorHex") ?? "").trim();
            const logoUrlField = String(formData.get("logoUrl") ?? "").trim();
            const result = await updateTournamentAction({
              tournamentSlug,
              name,
              colorHex: colorHexRaw,
              logoUrl: logoUrlField,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="branding-name">Tournament name</Label>
          <Input
            id="branding-name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={initialName}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="branding-color">Theme color</Label>
            <input
              id="branding-color"
              name="colorHex"
              type="color"
              defaultValue={colorValue}
              className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
            />
          </div>
        </div>
        <ImageUploadOrUrlField
          tournamentSlug={tournamentSlug}
          purpose="tournament-logo"
          label="Tournament logo"
          urlInputId="branding-logo-url"
          urlInputName="logoUrl"
          urlValue={logoUrl}
          onUrlChange={setLogoUrl}
          uploadsEnabled={uploadsEnabled}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" disabled={pending} className="min-h-11 w-full">
            {pending ? "Saving…" : "Save look"}
          </Button>
          <Link
            href={ROUTES.teams(tournamentSlug)}
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 w-full")}
          >
            Edit teams
          </Link>
        </div>
      </form>
    </section>
  );
}
