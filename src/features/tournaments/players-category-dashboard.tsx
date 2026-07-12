import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface PlayersCategoryDashboardRow {
  rosterCategoryId: string;
  name: string;
  colorHex: string | null;
  count: number;
}

interface PlayersCategoryDashboardProps {
  rows: PlayersCategoryDashboardRow[];
  totalPlayers: number;
}

export function PlayersCategoryDashboard({ rows, totalPlayers }: PlayersCategoryDashboardProps) {
  const activeRows = rows.filter((row) => row.count > 0);

  return (
    <section
      className="rounded-xl border border-border/70 bg-card/35 p-4 backdrop-blur-md sm:p-5"
      aria-labelledby="players-category-dash-heading"
    >
      <h3
        id="players-category-dash-heading"
        className="text-sm font-semibold tracking-tight text-foreground sm:text-base"
      >
        Roster mix
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        <span className="font-semibold text-foreground tabular-nums">{totalPlayers}</span>{" "}
        {totalPlayers === 1 ? "player" : "players"} across roster groups ({activeRows.length} group
        {activeRows.length === 1 ? "" : "s"} occupied).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Configure roster groups first, then add players.
          </p>
        ) : (
          rows.map((row) => (
            <Card key={row.rosterCategoryId} className="h-full border-border/80 bg-card/40">
              <CardHeader className="gap-2">
                <RosterCategoryPill name={row.name} colorHex={row.colorHex} />
                <CardTitle className="text-3xl font-semibold tracking-tight">{row.count}</CardTitle>
                <CardDescription>
                  {row.count === 1 ? "Player" : "Players"} in this roster group
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
