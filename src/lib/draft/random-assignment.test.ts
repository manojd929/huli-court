import { describe, expect, it } from "vitest";

import {
  buildRandomAssignmentPlan,
  type RandomAssignmentInput,
} from "@/lib/draft/random-assignment";

/** Deterministic LCG so tests never flake. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function makeInput(overrides: Partial<RandomAssignmentInput> = {}): RandomAssignmentInput {
  return {
    players: [
      { id: "p1", rosterCategoryId: "catA" },
      { id: "p2", rosterCategoryId: "catA" },
      { id: "p3", rosterCategoryId: "catB" },
      { id: "p4", rosterCategoryId: "catB" },
    ],
    teams: [
      { id: "t1", existingTotal: 0, existingByCategory: {} },
      { id: "t2", existingTotal: 0, existingByCategory: {} },
    ],
    categoryCaps: { catA: 1, catB: 1 },
    picksPerTeam: 2,
    rng: seededRng(42),
    ...overrides,
  };
}

describe("buildRandomAssignmentPlan", () => {
  it("assigns every player when capacity matches exactly", () => {
    const plan = buildRandomAssignmentPlan(makeInput());
    expect(plan.assignments).toHaveLength(4);
    expect(plan.unassignedPlayerIds).toHaveLength(0);
  });

  it("never exceeds per-category caps on any team", () => {
    const plan = buildRandomAssignmentPlan(makeInput());
    const byTeamCat = new Map<string, number>();
    for (const a of plan.assignments) {
      const player = makeInput().players.find((p) => p.id === a.playerId)!;
      const key = `${a.teamId}:${player.rosterCategoryId}`;
      byTeamCat.set(key, (byTeamCat.get(key) ?? 0) + 1);
    }
    for (const count of byTeamCat.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it("never exceeds picksPerTeam", () => {
    const plan = buildRandomAssignmentPlan(
      makeInput({
        players: Array.from({ length: 10 }, (_, i) => ({
          id: `p${i}`,
          rosterCategoryId: "catA",
        })),
        categoryCaps: { catA: 10 },
        picksPerTeam: 3,
      }),
    );
    const totals = new Map<string, number>();
    for (const a of plan.assignments) {
      totals.set(a.teamId, (totals.get(a.teamId) ?? 0) + 1);
    }
    for (const total of totals.values()) {
      expect(total).toBeLessThanOrEqual(3);
    }
    expect(plan.assignments).toHaveLength(6);
    expect(plan.unassignedPlayerIds).toHaveLength(4);
  });

  it("reports players that cannot fit under caps as unassigned", () => {
    const plan = buildRandomAssignmentPlan(
      makeInput({
        players: [
          { id: "p1", rosterCategoryId: "catA" },
          { id: "p2", rosterCategoryId: "catA" },
          { id: "p3", rosterCategoryId: "catA" },
        ],
        categoryCaps: { catA: 1 },
      }),
    );
    expect(plan.assignments).toHaveLength(2);
    expect(plan.unassignedPlayerIds).toHaveLength(1);
  });

  it("treats a category with no squad rule as cap 0", () => {
    const plan = buildRandomAssignmentPlan(
      makeInput({
        players: [{ id: "p1", rosterCategoryId: "catX" }],
      }),
    );
    expect(plan.assignments).toHaveLength(0);
    expect(plan.unassignedPlayerIds).toEqual(["p1"]);
  });

  it("respects existing occupancy from picks and owner stubs", () => {
    const plan = buildRandomAssignmentPlan(
      makeInput({
        teams: [
          {
            id: "t1",
            existingTotal: 2, // full: picksPerTeam is 2
            existingByCategory: { catA: 1, catB: 1 },
          },
          { id: "t2", existingTotal: 0, existingByCategory: {} },
        ],
      }),
    );
    // Only t2 has room: one catA + one catB fit; the other two cannot.
    expect(plan.assignments).toHaveLength(2);
    expect(plan.assignments.every((a) => a.teamId === "t2")).toBe(true);
    expect(plan.unassignedPlayerIds).toHaveLength(2);
  });

  it("keeps team totals balanced within one player", () => {
    const plan = buildRandomAssignmentPlan(
      makeInput({
        players: Array.from({ length: 9 }, (_, i) => ({
          id: `p${i}`,
          rosterCategoryId: "catA",
        })),
        teams: [
          { id: "t1", existingTotal: 0, existingByCategory: {} },
          { id: "t2", existingTotal: 0, existingByCategory: {} },
          { id: "t3", existingTotal: 0, existingByCategory: {} },
        ],
        categoryCaps: { catA: 5 },
        picksPerTeam: 5,
      }),
    );
    const totals = new Map<string, number>();
    for (const a of plan.assignments) {
      totals.set(a.teamId, (totals.get(a.teamId) ?? 0) + 1);
    }
    const counts = [...totals.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(plan.assignments).toHaveLength(9);
  });

  it("is deterministic for a fixed rng seed", () => {
    const a = buildRandomAssignmentPlan(makeInput({ rng: seededRng(7) }));
    const b = buildRandomAssignmentPlan(makeInput({ rng: seededRng(7) }));
    expect(a).toEqual(b);
  });
});
