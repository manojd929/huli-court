export interface PickLimitsCategoryFitRow {
  rosterCategoryId: string;
  rosterCategoryName: string;
  rosterCategoryColorHex: string | null;
  pool: number;
  fairCapPerTeam: number;
  remainderAfterEvenSplit: number;
}

interface PickLimitsGuidanceProps {
  teamCount: number;
  picksPerTeam: number;
  totalPlayers: number;
}

export function PickLimitsGuidance({
  teamCount,
  picksPerTeam,
  totalPlayers,
}: PickLimitsGuidanceProps) {
  const draftPickSlots = teamCount > 0 && picksPerTeam > 0 ? teamCount * picksPerTeam : 0;
  const playersMissingForFullDraft =
    draftPickSlots > 0 ? Math.max(0, draftPickSlots - totalPlayers) : 0;
  const extraPlayersBeyondDraft =
    draftPickSlots > 0 ? Math.max(0, totalPlayers - draftPickSlots) : 0;

  return (
    <section
      className="space-y-6 rounded-xl border border-border/70 bg-muted/20 p-6 backdrop-blur-md sm:p-8"
      aria-labelledby="pick-limits-guidance-heading"
    >
      <div className="space-y-2">
        <h3
          id="pick-limits-guidance-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          How pick limits relate to your roster
        </h3>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Pick limits cap how many players each franchise may take from each roster group. They do
          not change how many turns each team gets in the snake draft. That comes from{" "}
          <strong className="font-medium text-foreground">picks each team makes</strong> set when
          the tournament was created.
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          <strong className="font-medium text-foreground">Auto-set limits from roster</strong> sets
          each line to{" "}
          <strong className="font-medium text-foreground">
            floor (players in that group ÷ number of teams)
          </strong>
          . Every group is calculated on its own, so one line can look larger than another simply
          because more players are tagged in that category.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Draft length from tournament settings
        </h4>
        {teamCount <= 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Add at least one team to see how many draft picks the snake will use.
          </p>
        ) : (
          <>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              The next few lines are <strong className="font-medium text-foreground">only</strong>{" "}
              about how long the snake is:{" "}
              <strong className="font-medium text-foreground">picks each team makes</strong>, which
              was set when this tournament was created (including if you kept the default). They do{" "}
              <strong className="font-medium text-foreground">not</strong> come from the category
              pick limits on this page. Those caps govern who can be taken from each group, not how
              many total rounds the draft has.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              With that setting, this tournament runs{" "}
              <strong className="font-medium text-foreground">{picksPerTeam}</strong>{" "}
              {picksPerTeam === 1 ? "pick" : "picks"} per team ×{" "}
              <strong className="font-medium text-foreground">{teamCount}</strong>{" "}
              {teamCount === 1 ? "team" : "teams"} ={" "}
              <strong className="font-medium text-foreground">{draftPickSlots}</strong>{" "}
              {draftPickSlots === 1 ? "pick" : "picks"} in the snake (each uses one distinct
              player).
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                You currently have{" "}
                <strong className="font-medium text-foreground">{totalPlayers}</strong> players on
                the roster.
              </li>
              {playersMissingForFullDraft > 0 ? (
                <li>
                  <strong className="font-medium text-foreground">
                    For this configured draft length only:
                  </strong>{" "}
                  you need at least <strong className="text-foreground">{draftPickSlots}</strong>{" "}
                  players for every slot to fill without re-using someone (
                  <strong className="text-foreground">{playersMissingForFullDraft}</strong> short).
                  Add players or create a new tournament with more picks per team if you want a
                  longer snake.
                </li>
              ) : draftPickSlots > 0 ? (
                <li>
                  {extraPlayersBeyondDraft > 0 ? (
                    <>
                      Roster is larger than this snake configuration (
                      <strong className="font-medium text-foreground">{draftPickSlots}</strong>{" "}
                      slots). Only that many players can be chosen{" "}
                      <strong className="font-medium text-foreground">during this draft</strong> if
                      every turn is used once. The other{" "}
                      <strong className="font-medium text-foreground">
                        {extraPlayersBeyondDraft}
                      </strong>{" "}
                      stay on the roster. That is normal, not an error. They are still subject to
                      your category caps for any pick that reaches them; the short snake simply
                      means not everyone will be picked in this run.
                    </>
                  ) : (
                    <>
                      Player count matches this draft length:{" "}
                      <strong className="font-medium text-foreground">{draftPickSlots}</strong>{" "}
                      roster players for{" "}
                      <strong className="font-medium text-foreground">{draftPickSlots}</strong>{" "}
                      snake picks (each slot can take one person with no shortfall).
                    </>
                  )}
                </li>
              ) : null}
            </ul>
          </>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Even split per group (auto-set)</h4>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          When every team shares the same max from a category, only{" "}
          <strong className="font-medium text-foreground">teams × floor(pool ÷ teams)</strong>{" "}
          players line up with that symmetric cap. If any group leaves a remainder, the{" "}
          <strong className="font-medium text-foreground">
            inline amber notice under that group
          </strong>{" "}
          lists numbers and options (recategorize, add players, or raise caps manually).
        </p>
      </div>

      <div className="border-t border-border/60 pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Hint text under each field shows pool size and fair-share floor; uneven splits add a
          second line with actions. Auto-set writes the floor; manual edits stick until you save or
          auto-set again.
        </p>
      </div>
    </section>
  );
}
