import type { Sport, TournamentFormat } from "@/generated/prisma/enums";

export interface SportMeta {
  /** Display name, e.g. "Table Tennis". */
  label: string;
  /** Emoji used as a lightweight sport marker in chips/headers. */
  emoji: string;
  /** The object hit in play — used in copy ("assign the shuttle", "the ball"). */
  piece: string;
  /** Which match formats make sense for this sport (all racquet sports use these). */
  formats: TournamentFormat[];
  /** Typical points a game runs to — a hint for score entry, not enforced. */
  gamePoints: number;
}

/**
 * Single source of truth for racquet-sport terminology and defaults. The match
 * model (singles/doubles + score-per-side) is shared; this only drives labels
 * and sensible defaults so the platform reads correctly per sport.
 */
export const SPORT_META: Record<Sport, SportMeta> = {
  BADMINTON: {
    label: "Badminton",
    emoji: "🏸",
    piece: "shuttle",
    formats: ["DOUBLES_ONLY", "MIXED", "SINGLES_ONLY"],
    gamePoints: 21,
  },
  PICKLEBALL: {
    label: "Pickleball",
    emoji: "🥒",
    piece: "ball",
    formats: ["DOUBLES_ONLY", "MIXED", "SINGLES_ONLY"],
    gamePoints: 11,
  },
  TENNIS: {
    label: "Tennis",
    emoji: "🎾",
    piece: "ball",
    formats: ["SINGLES_ONLY", "DOUBLES_ONLY", "MIXED"],
    gamePoints: 6,
  },
  TABLE_TENNIS: {
    label: "Table Tennis",
    emoji: "🏓",
    piece: "ball",
    formats: ["SINGLES_ONLY", "DOUBLES_ONLY", "MIXED"],
    gamePoints: 11,
  },
  SQUASH: {
    label: "Squash",
    emoji: "🎾",
    piece: "ball",
    formats: ["SINGLES_ONLY", "DOUBLES_ONLY"],
    gamePoints: 11,
  },
  PADEL: {
    label: "Padel",
    emoji: "🎾",
    piece: "ball",
    formats: ["DOUBLES_ONLY", "MIXED"],
    gamePoints: 6,
  },
  OTHER: {
    label: "Racquet sport",
    emoji: "🏸",
    piece: "ball",
    formats: ["DOUBLES_ONLY", "MIXED", "SINGLES_ONLY"],
    gamePoints: 21,
  },
};

/** Ordered list for pickers (most popular first). */
export const SPORT_OPTIONS: Sport[] = [
  "BADMINTON",
  "PICKLEBALL",
  "TENNIS",
  "TABLE_TENNIS",
  "SQUASH",
  "PADEL",
  "OTHER",
];

export function sportLabel(sport: Sport): string {
  return SPORT_META[sport]?.label ?? "Racquet sport";
}
