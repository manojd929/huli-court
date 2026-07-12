import { describe, expect, it } from "vitest";

import {
  computePerTeamCategoryCaps,
  sortSquadRulesByRosterCategoryOrder,
} from "./compute-per-team-caps";
import { validateSquadRulesAgainstRoster } from "./validate-squad-rules-against-roster";

const CAT_BEGINNER = "00000000-0000-4000-8000-000000000001";
const CAT_INTERMEDIATE = "00000000-0000-4000-8000-000000000002";
const CAT_ADVANCED = "00000000-0000-4000-8000-000000000003";
const CAT_WOMEN = "00000000-0000-4000-8000-000000000004";

const categoryOrder = [CAT_BEGINNER, CAT_INTERMEDIATE, CAT_ADVANCED, CAT_WOMEN];

const labels: Record<string, string> = {
  [CAT_BEGINNER]: "Men Beginner",
  [CAT_INTERMEDIATE]: "Men Intermediate",
  [CAT_ADVANCED]: "Men Advanced",
  [CAT_WOMEN]: "Women",
};

describe("sortSquadRulesByRosterCategoryOrder", () => {
  it("orders rows by commissioner category ladder", () => {
    const mixed = [
      { rosterCategoryId: CAT_ADVANCED, maxCount: 5 },
      { rosterCategoryId: CAT_WOMEN, maxCount: 2 },
      { rosterCategoryId: CAT_BEGINNER, maxCount: 10 },
      { rosterCategoryId: CAT_INTERMEDIATE, maxCount: 2 },
    ];
    const sorted = sortSquadRulesByRosterCategoryOrder(mixed, categoryOrder);
    expect(sorted.map((r) => r.rosterCategoryId)).toEqual(categoryOrder);
  });
});

describe("computePerTeamCategoryCaps", () => {
  it("uses fair floor(pool / teams) per category", () => {
    const caps = computePerTeamCategoryCaps({
      teamCount: 4,
      categoryOrder,
      playersPerCategory: { [CAT_INTERMEDIATE]: 50 },
    });
    expect(caps[CAT_INTERMEDIATE]).toBe(12);
    expect(caps[CAT_BEGINNER]).toBe(0);
  });

  it("returns zeros when there are no teams", () => {
    const caps = computePerTeamCategoryCaps({
      teamCount: 0,
      categoryOrder,
      playersPerCategory: { [CAT_INTERMEDIATE]: 99 },
    });
    expect(caps[CAT_INTERMEDIATE]).toBe(0);
  });
});

function fourCategoryPools(
  partial: Partial<Record<string, number>>,
): Partial<Record<string, number>> {
  const base: Partial<Record<string, number>> = {
    [CAT_BEGINNER]: 0,
    [CAT_INTERMEDIATE]: 0,
    [CAT_ADVANCED]: 0,
    [CAT_WOMEN]: 0,
  };
  return { ...base, ...partial };
}

describe("validateSquadRulesAgainstRoster", () => {
  it("fails when snake draft needs more players than on roster (default)", () => {
    const playersPerCategory = fourCategoryPools({
      [CAT_INTERMEDIATE]: 30,
    });
    const caps = computePerTeamCategoryCaps({
      teamCount: 4,
      categoryOrder,
      playersPerCategory,
    });
    const rules = categoryOrder.map((rosterCategoryId) => ({
      rosterCategoryId,
      maxCount: caps[rosterCategoryId] ?? 0,
    }));

    const result = validateSquadRulesAgainstRoster({
      teamCount: 4,
      picksPerTeam: 10,
      totalPlayers: 30,
      playersPerCategory,
      categoryLabels: labels,
      rules,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors.some((e) => e.includes("Not enough players"))).toBe(true);
  });

  it("passes draft-length check when requireDraftSlotsVsRoster is false (auto-set)", () => {
    const playersPerCategory = fourCategoryPools({
      [CAT_INTERMEDIATE]: 30,
    });
    const caps = computePerTeamCategoryCaps({
      teamCount: 4,
      categoryOrder,
      playersPerCategory,
    });
    const rules = categoryOrder.map((rosterCategoryId) => ({
      rosterCategoryId,
      maxCount: caps[rosterCategoryId] ?? 0,
    }));

    const result = validateSquadRulesAgainstRoster({
      teamCount: 4,
      picksPerTeam: 10,
      totalPlayers: 30,
      playersPerCategory,
      categoryLabels: labels,
      rules,
      requireDraftSlotsVsRoster: false,
    });

    expect(result.ok).toBe(true);
  });

  it("fair-share rules always satisfy per-category pool checks", () => {
    const playersPerCategory = fourCategoryPools({
      [CAT_BEGINNER]: 17,
      [CAT_INTERMEDIATE]: 50,
      [CAT_ADVANCED]: 14,
      [CAT_WOMEN]: 9,
    });
    const teamCount = 4;
    const caps = computePerTeamCategoryCaps({
      teamCount,
      categoryOrder,
      playersPerCategory,
    });
    const rules = categoryOrder.map((rosterCategoryId) => ({
      rosterCategoryId,
      maxCount: caps[rosterCategoryId] ?? 0,
    }));
    const totalPlayers =
      (playersPerCategory[CAT_BEGINNER] ?? 0) +
      (playersPerCategory[CAT_INTERMEDIATE] ?? 0) +
      (playersPerCategory[CAT_ADVANCED] ?? 0) +
      (playersPerCategory[CAT_WOMEN] ?? 0);

    const result = validateSquadRulesAgainstRoster({
      teamCount,
      picksPerTeam: 10,
      totalPlayers,
      playersPerCategory,
      categoryLabels: labels,
      rules,
      requireDraftSlotsVsRoster: false,
    });

    expect(result.ok).toBe(true);
  });
});
