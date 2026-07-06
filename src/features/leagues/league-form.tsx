"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/app";
import {
  createLeagueAction,
  updateLeagueAction,
} from "@/features/leagues/actions";
import { cn } from "@/lib/utils";

interface LeagueFormProps {
  /** When set, the form edits an existing league instead of creating one. */
  existing?: {
    slug: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    colorHex: string | null;
  };
}

export function LeagueForm({ existing }: LeagueFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(existing);

  return (
    <form
      className="mx-auto flex max-w-xl flex-col gap-6"
      action={(formData) => {
        startTransition(async () => {
          setError(null);
          const payload = {
            name: String(formData.get("name") ?? ""),
            description: String(formData.get("description") ?? "").trim() || undefined,
            logoUrl: String(formData.get("logoUrl") ?? "").trim(),
            colorHex: String(formData.get("colorHex") ?? "").trim(),
          };
          const result = isEdit
            ? await updateLeagueAction({ ...payload, slug: existing!.slug })
            : await createLeagueAction(payload);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.slug) {
            router.push(ROUTES.league(result.slug));
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="league-name">League name</Label>
        <Input
          id="league-name"
          name="name"
          required
          minLength={2}
          defaultValue={existing?.name}
          placeholder="Indiranagar Smashers League"
        />
        <p className="text-xs text-muted-foreground">
          The recurring banner your tournaments live under. Gets its own public
          page you can share.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="league-description">About (optional)</Label>
        <Textarea
          id="league-description"
          name="description"
          rows={3}
          defaultValue={existing?.description ?? undefined}
          placeholder="Who runs it, where it plays, what makes it special."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="league-logo">Logo URL (optional)</Label>
        <Input
          id="league-logo"
          name="logoUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          defaultValue={existing?.logoUrl ?? undefined}
          placeholder="https://… link to your logo image"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="league-color">Accent colour</Label>
        <input
          id="league-color"
          name="colorHex"
          type="color"
          defaultValue={existing?.colorHex ?? "#f2b21a"}
          className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" pending={pending} pendingLabel="Saving…" className="min-h-11">
          {isEdit ? "Save league" : "Create league"}
        </Button>
        <Link
          href={isEdit ? ROUTES.league(existing!.slug) : ROUTES.dashboard}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
