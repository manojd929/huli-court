import type { TournamentFormat } from "@/generated/prisma/enums";

export const TOURNAMENT_FORMAT_LABEL: Record<TournamentFormat, string> = {
  DOUBLES_ONLY: "Doubles",
  SINGLES_ONLY: "Singles",
  MIXED: "Mixed",
};
