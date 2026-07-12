"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadLeagueImageAction } from "@/features/uploads/upload-league-image-action";

export type LeagueImagePurpose = "team-logo" | "player-photo" | "tournament-logo";

interface ImageUploadOrUrlFieldProps {
  tournamentSlug: string;
  purpose: LeagueImagePurpose;
  label: string;
  urlInputId: string;
  urlInputName?: string;
  urlValue: string;
  onUrlChange: (url: string) => void;
  uploadsEnabled: boolean;
}

export function ImageUploadOrUrlField({
  tournamentSlug,
  purpose,
  label,
  urlInputId,
  urlInputName,
  urlValue,
  onUrlChange,
  uploadsEnabled,
}: ImageUploadOrUrlFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadsEnabled) return;

    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("tournamentSlug", tournamentSlug);
      formData.set("purpose", purpose);
      formData.set("file", file);
      const result = await uploadLeagueImageAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUrlChange(result.url);
    } finally {
      setBusy(false);
    }
  }

  const trimmedUrl = urlValue.trim();
  const showPreview = trimmedUrl !== "" && /^https?:\/\//u.test(trimmedUrl);

  return (
    <div className="space-y-2">
      <Label htmlFor={urlInputId}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => void onFileChange(event)}
          disabled={!uploadsEnabled || busy}
          aria-hidden
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!uploadsEnabled}
          pending={busy}
          pendingLabel="Uploading…"
          onClick={() => inputRef.current?.click()}
        >
          Upload image
        </Button>
        {trimmedUrl !== "" ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onUrlChange("")}>
            Clear
          </Button>
        ) : null}
      </div>
      {!uploadsEnabled ? (
        <p className="text-xs text-muted-foreground">
          Uploads aren&apos;t enabled on this workspace yet. Paste a public HTTPS image URL below,
          or ask your administrator to turn on file uploads.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP, or GIF · up to 15 MB · saved as WebP at most 2.5 MB.
        </p>
      )}
      <Input
        id={urlInputId}
        name={urlInputName}
        value={urlValue}
        onChange={(event) => onUrlChange(event.target.value)}
        placeholder="Or paste https://… image URL"
        autoComplete="off"
      />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {showPreview ? (
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-2">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md ring-1 ring-border">
            <Image src={trimmedUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
          </div>
          <span className="truncate text-xs text-muted-foreground">{trimmedUrl}</span>
        </div>
      ) : null}
    </div>
  );
}
