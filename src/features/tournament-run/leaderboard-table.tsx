import { TournamentFormat } from "@/generated/prisma/enums";
import type { StandingRow } from "@/services/tournament-run-service";

interface LeaderboardTableProps {
  format: TournamentFormat;
  standings: StandingRow[];
}

export function LeaderboardTable({ format, standings }: LeaderboardTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/40 shadow-sm backdrop-blur-sm">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-muted/45 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Rank</th>
            <th className="px-4 py-3 font-medium">
              {format === TournamentFormat.DOUBLES_ONLY ? "Team" : "Player"}
            </th>
            <th className="px-4 py-3 font-medium">MP</th>
            <th className="px-4 py-3 font-medium">W</th>
            <th className="px-4 py-3 font-medium">L</th>
            <th className="px-4 py-3 font-medium">Pts</th>
            <th className="px-4 py-3 font-medium">Scored</th>
            <th className="px-4 py-3 font-medium">Conceded</th>
            <th className="px-4 py-3 font-medium">Diff</th>
            <th className="px-4 py-3 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => (
            <tr key={row.entityId} className="border-t border-border/60">
              <td className="px-4 py-3 font-semibold text-foreground">{index + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{row.name}</div>
              </td>
              <td className="px-4 py-3">{row.matchesPlayed}</td>
              <td className="px-4 py-3">{row.wins}</td>
              <td className="px-4 py-3">{row.losses}</td>
              <td className="px-4 py-3 font-semibold text-foreground">{row.points}</td>
              <td className="px-4 py-3">{row.pointsScored}</td>
              <td className="px-4 py-3">{row.pointsConceded}</td>
              <td className="px-4 py-3">{row.pointDifference}</td>
              <td className="px-4 py-3">{row.eliminated ? "Eliminated" : "Active"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
