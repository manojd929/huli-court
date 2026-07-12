/**
 * Pure planner for the RANDOM_ASSIGNMENT allocation method.
 *
 * Given the eligible player pool and each team's existing occupancy, produces
 * a balanced random assignment that respects per-category squad caps and the
 * tournament-wide picksPerTeam ceiling. Players that cannot fit anywhere are
 * reported as unassigned rather than force-placed.
 */

export interface RandomAssignmentPlayer {
  id: string;
  rosterCategoryId: string;
}

export interface RandomAssignmentTeam {
  id: string;
  /** Confirmed picks + owner-stub roster rows already occupying slots. */
  existingTotal: number;
  /** Occupancy per roster category (confirmed picks + owner stubs). */
  existingByCategory: Record<string, number>;
}

export interface RandomAssignmentInput {
  players: RandomAssignmentPlayer[];
  teams: RandomAssignmentTeam[];
  /** Max players per roster category per team; categories absent here have cap 0. */
  categoryCaps: Record<string, number>;
  picksPerTeam: number;
  /** Injectable for deterministic tests; defaults to Math.random. */
  rng?: () => number;
}

export interface RandomAssignmentPlan {
  assignments: { playerId: string; teamId: string }[];
  unassignedPlayerIds: string[];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = swap;
  }
  return copy;
}

export function buildRandomAssignmentPlan(input: RandomAssignmentInput): RandomAssignmentPlan {
  const rng = input.rng ?? Math.random;
  const totals = new Map<string, number>();
  const byCategory = new Map<string, Map<string, number>>();
  for (const team of input.teams) {
    totals.set(team.id, team.existingTotal);
    byCategory.set(team.id, new Map(Object.entries(team.existingByCategory)));
  }

  const assignments: { playerId: string; teamId: string }[] = [];
  const unassignedPlayerIds: string[] = [];

  for (const player of shuffle(input.players, rng)) {
    const cap = input.categoryCaps[player.rosterCategoryId] ?? 0;
    const candidates = input.teams.filter((team) => {
      const total = totals.get(team.id) ?? 0;
      const catCount = byCategory.get(team.id)?.get(player.rosterCategoryId) ?? 0;
      return total < input.picksPerTeam && catCount < cap;
    });
    if (candidates.length === 0) {
      unassignedPlayerIds.push(player.id);
      continue;
    }

    // Fill the emptiest team first so squads end up even; break ties randomly.
    const minTotal = Math.min(...candidates.map((t) => totals.get(t.id) ?? 0));
    const emptiest = candidates.filter((t) => (totals.get(t.id) ?? 0) === minTotal);
    const chosen = emptiest[Math.floor(rng() * emptiest.length)]!;

    assignments.push({ playerId: player.id, teamId: chosen.id });
    totals.set(chosen.id, (totals.get(chosen.id) ?? 0) + 1);
    const catMap = byCategory.get(chosen.id)!;
    catMap.set(player.rosterCategoryId, (catMap.get(player.rosterCategoryId) ?? 0) + 1);
  }

  return { assignments, unassignedPlayerIds };
}
