/** Sort canonical category ids for deterministic UI (display order ASC, tie-break label). */

export interface RosterCategoryOrderRow {
  id: string;
  displayOrder: number;
  name: string;
}

export function rosterCategoryOrderIds(categories: RosterCategoryOrderRow[]): string[] {
  const sorted = [...categories].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  return sorted.map((c) => c.id);
}

/**
 * Fair-share picks per franchise from each category pool (floor(pool ÷ teamCount)).
 */
export function computePerTeamCategoryCaps(params: {
  teamCount: number;
  categoryOrder: readonly string[];
  playersPerCategory: Partial<Record<string, number>>;
  doublesCategoryIds?: ReadonlySet<string>;
}): Record<string, number> {
  const {
    teamCount,
    categoryOrder,
    playersPerCategory,
    doublesCategoryIds = new Set<string>(),
  } = params;
  const result: Record<string, number> = {};

  for (const categoryId of categoryOrder) {
    const pool = playersPerCategory[categoryId] ?? 0;
    const fairShare = teamCount > 0 ? Math.floor(pool / teamCount) : 0;
    const doublesMinimum = doublesCategoryIds.has(categoryId) ? 2 : 1;
    if (teamCount > 0 && pool >= teamCount * doublesMinimum) {
      result[categoryId] = Math.max(fairShare, doublesMinimum);
      continue;
    }
    result[categoryId] = fairShare;
  }

  return result;
}

/** Sort squad rule rows to match commissioner category ordering. */

export function sortSquadRulesByRosterCategoryOrder<T extends { rosterCategoryId: string }>(
  rows: T[],
  categoryOrder: readonly string[],
): T[] {
  const orderIndex = new Map(categoryOrder.map((id, idx) => [id, idx]));
  return [...rows].sort(
    (a, b) =>
      (orderIndex.get(a.rosterCategoryId) ?? 999) - (orderIndex.get(b.rosterCategoryId) ?? 999),
  );
}
