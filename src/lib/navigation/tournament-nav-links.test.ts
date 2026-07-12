import { describe, expect, it } from "vitest";

import { tournamentChromeNavGroups } from "./tournament-nav-links";

describe("tournamentChromeNavGroups", () => {
  it("groups commissioner links into league, auction, and tournament clusters", () => {
    const groups = tournamentChromeNavGroups("summer-cup", "commissioner", {
      showFixtures: true,
    });

    expect(groups.map((group) => group.label)).toEqual(["League", "Auction", "Tournament"]);
    expect(groups[0]?.links.map((link) => link.label)).toEqual([
      "Home",
      "Roster groups",
      "All Players",
      "All Teams",
      "Rules",
    ]);
    expect(groups[1]?.links.map((link) => link.label)).toEqual([
      "Manage auction",
      "Live roster board",
    ]);
    expect(groups[2]?.links.map((link) => link.label)).toEqual([
      "Fixtures",
      "Run tournament",
      "Knockout board",
    ]);
  });

  it("keeps participant-only links in the league or auction groups", () => {
    const groups = tournamentChromeNavGroups("summer-cup", "participant");

    expect(groups[0]?.links.map((link) => link.label)).toContain("My Team");
    expect(groups[1]?.links.map((link) => link.label)).toEqual([
      "Auction board",
      "Live roster board",
    ]);
  });

  it("hides the entire tournament cluster before fixtures unlock", () => {
    const commissionerGroups = tournamentChromeNavGroups("summer-cup", "commissioner", {
      showFixtures: false,
    });
    const participantGroups = tournamentChromeNavGroups("summer-cup", "participant", {
      showFixtures: false,
    });

    expect(commissionerGroups.map((group) => group.label)).toEqual(["League", "Auction"]);
    expect(participantGroups.map((group) => group.label)).toEqual(["League", "Auction"]);
  });
});
