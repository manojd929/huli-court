"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveSquadRulesAction } from "@/features/tournaments/actions";
import type { PickLimitsCategoryFitRow } from "@/features/tournaments/pick-limits-guidance";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { sortSquadRulesByRosterCategoryOrder } from "@/lib/squad-rules/compute-per-team-caps";
import type { SquadRuleDto } from "@/types/draft";

interface SquadRulesFormProps {
  tournamentSlug: string;
  initialRules: SquadRuleDto[];
  rosterSummary: {
    teamCount: number;
    playersPerCategory: Partial<Record<string, number>>;
    categoryFitRows: PickLimitsCategoryFitRow[];
  };
}

function rosterCategorySortOrder(initialRules: SquadRuleDto[]): string[] {
  return initialRules.map((r) => r.rosterCategoryId);
}

export function SquadRulesForm({
  tournamentSlug,
  initialRules,
  rosterSummary,
}: SquadRulesFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canonicalOrder = rosterCategorySortOrder(initialRules);
  const ordered = sortSquadRulesByRosterCategoryOrder(initialRules, canonicalOrder);
  const [capValues, setCapValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(ordered.map((rule) => [rule.rosterCategoryId, String(rule.maxCount)])),
  );

  const { teamCount, playersPerCategory, categoryFitRows } = rosterSummary;

  const fitByCategory = new Map(categoryFitRows.map((row) => [row.rosterCategoryId, row]));

  return (
    <form
      className="space-y-6 rounded-xl border border-border/70 bg-card/40 p-6 backdrop-blur-md"
      action={() => {
        startTransition(async () => {
          setError(null);
          const rules = ordered.map((rule) => ({
            rosterCategoryId: rule.rosterCategoryId,
            maxCount: Number(capValues[rule.rosterCategoryId] ?? rule.maxCount),
          }));
          const result = await saveSquadRulesAction({
            tournamentSlug,
            rules,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {ordered.map((rule) => {
          const pool = playersPerCategory[rule.rosterCategoryId] ?? 0;
          const fairFloor = teamCount > 0 ? Math.floor(pool / teamCount) : 0;
          const fit = fitByCategory.get(rule.rosterCategoryId);
          const remainder = fit?.remainderAfterEvenSplit ?? 0;
          const allocated = teamCount > 0 && fit ? teamCount * fit.fairCapPerTeam : 0;
          const addForEven =
            teamCount > 0 && pool > 0 ? Math.ceil(pool / teamCount) * teamCount - pool : 0;
          const fieldId = `cap-${rule.rosterCategoryId}`;
          const fieldName = fieldId;

          return (
            <div key={rule.rosterCategoryId} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={fieldId} className="text-sm font-semibold tracking-tight">
                  {rule.rosterCategoryName}
                </Label>
                <RosterCategoryPill
                  name={rule.rosterCategoryName}
                  colorHex={rule.rosterCategoryColorHex}
                  className="max-w-max"
                />
              </div>
              <Input
                id={fieldId}
                name={fieldName}
                type="number"
                min={0}
                max={50}
                value={capValues[rule.rosterCategoryId] ?? ""}
                onChange={(event) => {
                  setCapValues((current) => ({
                    ...current,
                    [rule.rosterCategoryId]: event.target.value,
                  }));
                }}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {teamCount <= 0 ? (
                  <>Add teams first. Fair-share caps use roster count ÷ teams.</>
                ) : (
                  <>
                    <span className="text-foreground/90">{pool}</span>{" "}
                    {pool === 1 ? "player" : "players"} in this group ·{" "}
                    <span className="text-foreground/90">{teamCount}</span>{" "}
                    {teamCount === 1 ? "team" : "teams"}
                    {" · "}
                    Auto-set uses ⌊pool ÷ teams⌋ ={" "}
                    <span className="font-medium text-foreground/90">{fairFloor}</span> for this
                    group (your saved cap above can differ).
                  </>
                )}
              </p>
              {teamCount > 0 && remainder > 0 ? (
                <p
                  role="status"
                  className="rounded-md border border-amber-500/45 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground dark:bg-amber-950/35"
                >
                  <strong className="font-semibold">Uneven split:</strong> identical caps only cover{" "}
                  <strong>{allocated}</strong> of <strong>{pool}</strong> players ({teamCount}×
                  {fairFloor}).{" "}
                  <strong>
                    {remainder} player{remainder === 1 ? "" : "s"}
                  </strong>{" "}
                  still exceed that symmetric split: <strong>recategorize {remainder}</strong>,{" "}
                  <strong>add {addForEven} more here</strong> so the pool divides evenly by{" "}
                  {teamCount}, or raise this cap manually.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="text-sm whitespace-pre-wrap text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" pending={pending} pendingLabel="Saving…">
        Save squad caps
      </Button>
    </form>
  );
}
