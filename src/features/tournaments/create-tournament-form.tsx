"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/app";
import { SPORT_META, SPORT_OPTIONS } from "@/constants/sport-meta";
import { DEFAULT_PICKS_PER_TEAM } from "@/constants/tournament-defaults";
import { createTournamentAction } from "@/features/tournaments/actions";
import { cn } from "@/lib/utils";

const ALLOCATION_METHODS = [
  {
    value: "SNAKE_DRAFT",
    label: "Snake draft",
    hint: "Owners pick in a shuffled order that reverses every round. Free.",
  },
  {
    value: "RANDOM_ASSIGNMENT",
    label: "Random assignment",
    hint: "One tap shuffles every player into balanced teams. Free.",
  },
  {
    value: "LIVE_AUCTION",
    label: "Live auction",
    hint: "IPL-style bidding with team purses; owners bid from their phones.",
  },
] as const;

interface CreateTournamentFormProps {
  leagues?: { id: string; name: string }[];
  defaultLeagueId?: string;
}

export function CreateTournamentForm({
  leagues = [],
  defaultLeagueId = "",
}: CreateTournamentFormProps = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [allocationMethod, setAllocationMethod] = useState<string>("SNAKE_DRAFT");

  return (
    <form
      className="mx-auto flex max-w-xl flex-col gap-6"
      action={(formData) => {
        startTransition(async () => {
          setError(null);
          const picksPerTeamRaw = String(formData.get("picksPerTeam") ?? "").trim();
          const playerEntryFeeRaw = String(formData.get("playerEntryFeeRupeesWhole") ?? "").trim();
          const auctionPurseRaw = String(formData.get("auctionPurse") ?? "").trim();
          const auctionMinIncrementRaw = String(formData.get("auctionMinIncrement") ?? "").trim();
          const auctionBasePriceRaw = String(formData.get("auctionDefaultBasePrice") ?? "").trim();
          const result = await createTournamentAction({
            name: String(formData.get("name") ?? ""),
            sport: String(formData.get("sport") ?? "").trim() || "BADMINTON",
            leagueId: String(formData.get("leagueId") ?? "").trim() || "",
            season: String(formData.get("season") ?? "").trim() || undefined,
            tournamentFormat:
              String(formData.get("tournamentFormat") ?? "").trim() || "DOUBLES_ONLY",
            allocationMethod,
            ...(allocationMethod === "LIVE_AUCTION" && auctionPurseRaw !== ""
              ? { auctionPurse: Number(auctionPurseRaw) }
              : {}),
            ...(allocationMethod === "LIVE_AUCTION" && auctionMinIncrementRaw !== ""
              ? { auctionMinIncrement: Number(auctionMinIncrementRaw) }
              : {}),
            ...(allocationMethod === "LIVE_AUCTION" && auctionBasePriceRaw !== ""
              ? { auctionDefaultBasePrice: Number(auctionBasePriceRaw) }
              : {}),
            description: String(formData.get("description") ?? "").trim() || undefined,
            ...(picksPerTeamRaw !== "" ? { picksPerTeam: Number(picksPerTeamRaw) } : {}),
            logoUrl: String(formData.get("logoUrl") ?? "").trim(),
            colorHex: String(formData.get("colorHex") ?? "").trim(),
            ...(playerEntryFeeRaw !== ""
              ? { playerEntryFeeRupeesWhole: Number(playerEntryFeeRaw) }
              : {}),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.slug) {
            router.push(ROUTES.categories(result.slug));
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="tournament-sport">Sport</Label>
        <select
          id="tournament-sport"
          name="sport"
          defaultValue="BADMINTON"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {SPORT_OPTIONS.map((sport) => (
            <option key={sport} value={sport}>
              {SPORT_META[sport].emoji} {SPORT_META[sport].label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Runs singles, doubles, and mixed draws for any racquet sport.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Tournament name</Label>
        <Input id="name" name="name" required minLength={2} placeholder="Summer Smash Cup 2026" />
      </div>
      {leagues.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tournament-league">
              League <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <select
              id="tournament-league"
              name="leagueId"
              defaultValue={defaultLeagueId}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Standalone (no league)</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tournament-season">
              Season <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="tournament-season"
              name="season"
              maxLength={40}
              placeholder="e.g. Summer 2026"
            />
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="tournament-format">Tournament format</Label>
        <select
          id="tournament-format"
          name="tournamentFormat"
          defaultValue="DOUBLES_ONLY"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="DOUBLES_ONLY">Doubles only</option>
          <option value="MIXED">Mixed (Doubles + Singles)</option>
          <option value="SINGLES_ONLY">Singles only</option>
        </select>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How are teams formed?</legend>
        <div className="grid gap-2">
          {ALLOCATION_METHODS.map((method) => (
            <label
              key={method.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                allocationMethod === method.value
                  ? "border-brand/60 bg-brand-soft/60 ring-1 ring-brand/30"
                  : "hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="allocationMethod"
                value={method.value}
                checked={allocationMethod === method.value}
                onChange={() => setAllocationMethod(method.value)}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="block text-sm font-medium">{method.label}</span>
                <span className="block text-xs text-muted-foreground">{method.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {allocationMethod === "LIVE_AUCTION" && (
        <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="auction-purse">Purse per team</Label>
            <Input
              id="auction-purse"
              name="auctionPurse"
              type="number"
              min={100}
              inputMode="numeric"
              placeholder="Default 10000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auction-min-increment">Min bid increment</Label>
            <Input
              id="auction-min-increment"
              name="auctionMinIncrement"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="Default 100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auction-base-price">Default base price</Label>
            <Input
              id="auction-base-price"
              name="auctionDefaultBasePrice"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Default 100"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            All values are in points (not currency). Per-player base prices can be set later on the
            players screen.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="description">Notes (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Anything your helpers should remember"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tournament-logo-url">Tournament logo (optional)</Label>
        <Input
          id="tournament-logo-url"
          name="logoUrl"
          type="url"
          inputMode="url"
          placeholder="https://… link to your logo image"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tournament-theme-color">Theme color</Label>
        <input
          id="tournament-theme-color"
          name="colorHex"
          type="color"
          defaultValue="#f2b21a"
          className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="picksPerTeam">
          Picks each team makes{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="picksPerTeam"
          name="picksPerTeam"
          type="number"
          min={1}
          max={50}
          placeholder={`Default ${DEFAULT_PICKS_PER_TEAM}`}
          aria-describedby="picksPerTeam-hint"
        />
        <p id="picksPerTeam-hint" className="text-xs text-muted-foreground">
          Leave blank to use {DEFAULT_PICKS_PER_TEAM} snake-draft picks per team. Enter a number
          between 1 and 50 only if you want a different draft length.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="player-entry-fee-inr">
          Player entry fee (INR){" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="player-entry-fee-inr"
          name="playerEntryFeeRupeesWhole"
          type="number"
          min={0}
          max={5_000_000}
          step={1}
          inputMode="numeric"
          placeholder="e.g. 1500"
          aria-describedby="player-entry-fee-hint"
        />
        <p id="player-entry-fee-hint" className="text-xs text-muted-foreground">
          Whole rupees per athlete; stored internally on the tournament row with currency metadata
          for INR today. Omit when no published participation fee applies.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" pending={pending} pendingLabel="Creating…" className="min-h-11">
          Create tournament
        </Button>
        <Link href={ROUTES.dashboard} className={cn(buttonVariants({ variant: "outline" }))}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
