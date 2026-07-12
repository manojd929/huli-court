import { DraftPhase } from "@/generated/prisma/enums";
import { ROUTES } from "@/constants/app";

/** Links shown in tournament shell nav (sticky header pills). */
export type TournamentChromeNavLink = Readonly<{ href: string; label: string }>;
export type TournamentChromeNavGroup = Readonly<{
  id: "overview" | "auction" | "tournament";
  label: string;
  links: TournamentChromeNavLink[];
}>;

/**
 * Commissioners run the auction from Manage auction; nominee phones use Owner/Auction routes.
 */
export type TournamentChromeNavViewer = "commissioner" | "participant";

export function tournamentChromeNavLinks(
  slug: string,
  viewer: TournamentChromeNavViewer,
  options?: { showFixtures?: boolean },
): TournamentChromeNavLink[] {
  return tournamentChromeNavGroups(slug, viewer, options).flatMap((group) => group.links);
}

export function tournamentChromeNavGroups(
  slug: string,
  viewer: TournamentChromeNavViewer,
  options?: { showFixtures?: boolean },
): TournamentChromeNavGroup[] {
  const commissionerGroups: TournamentChromeNavGroup[] = [
    {
      id: "overview",
      label: "League",
      links: [
        { href: ROUTES.tournament(slug), label: "Home" },
        { href: ROUTES.categories(slug), label: "Roster groups" },
        { href: ROUTES.players(slug), label: "All Players" },
        { href: ROUTES.teams(slug), label: "All Teams" },
        { href: ROUTES.rules(slug), label: "Rules" },
      ],
    },
    {
      id: "auction",
      label: "Auction",
      links: [
        { href: ROUTES.admin(slug), label: "Manage auction" },
        { href: ROUTES.tv(slug), label: "Live roster board" },
      ],
    },
    ...(options?.showFixtures
      ? [
          {
            id: "tournament" as const,
            label: "Tournament",
            links: [
              { href: ROUTES.fixtures(slug), label: "Fixtures" as const },
              { href: ROUTES.run(slug), label: "Run tournament" as const },
              { href: ROUTES.leaderboard(slug), label: "Knockout board" as const },
            ],
          },
        ]
      : []),
  ];

  if (viewer === "participant") {
    return [
      {
        id: "overview",
        label: "League",
        links: [
          { href: ROUTES.tournament(slug), label: "Home" },
          { href: ROUTES.categories(slug), label: "Roster groups" },
          { href: ROUTES.players(slug), label: "All Players" },
          { href: ROUTES.teams(slug), label: "All Teams" },
          { href: ROUTES.rules(slug), label: "Rules" },
          { href: ROUTES.owner(slug), label: "My Team" },
        ],
      },
      {
        id: "auction",
        label: "Auction",
        links: [
          { href: ROUTES.draft(slug), label: "Auction board" },
          { href: ROUTES.tv(slug), label: "Live roster board" },
        ],
      },
      ...(options?.showFixtures
        ? [
            {
              id: "tournament" as const,
              label: "Tournament",
              links: [
                { href: ROUTES.fixtures(slug), label: "Fixtures" as const },
                { href: ROUTES.leaderboard(slug), label: "Knockout board" as const },
              ],
            },
          ]
        : []),
    ];
  }

  return commissionerGroups.filter((group) => group.links.length > 0);
}

/** Hub cards on tournament home (`/tournament/[slug]`). */
export type TournamentHubCard = Readonly<{
  href: (slug: string) => string;
  title: string;
  description: string;
  primary?: boolean;
  /**
   * When true, card is omitted for commissioners (auction creator).
   * Franchise owners and anyone else signed in without creator rights still sees these.
   */
  participantOnly?: boolean;
}>;

export const tournamentHubCards: TournamentHubCard[] = [
  {
    href: ROUTES.admin,
    title: "Run the auction",
    description:
      "Start, shuffle order, spotlight rounds, pause, confirm: everything you run from one desk.",
    primary: true,
  },
  {
    href: ROUTES.tv,
    title: "Live roster board",
    description:
      "Hall & projector view: franchises, drafted players by group, spotlight, clock, and picks. Refreshes automatically.",
    primary: true,
  },
  {
    href: ROUTES.categories,
    title: "Roster groups",
    description: "Labels, tint colors, display order: what shows on every roster surface.",
  },
  {
    href: ROUTES.teams,
    title: "All Teams",
    description: "Names, colors, logos, and franchise-owner logins.",
  },
  {
    href: ROUTES.players,
    title: "All Players",
    description: "Add nominees, attach photos, and sort them into roster groups.",
  },
  {
    href: ROUTES.rules,
    title: "Rules",
    description: "Caps per roster group: what each franchise can roster live.",
  },
  {
    href: ROUTES.owner,
    title: "My Team",
    description: "See only your franchise roster from confirmed picks.",
    participantOnly: true,
  },
];

export function tournamentHubCardsForViewer(options: {
  isCommissioner: boolean;
  draftPhase?: (typeof DraftPhase)[keyof typeof DraftPhase];
  showFixtures?: boolean;
}): TournamentHubCard[] {
  if (options.isCommissioner) {
    return tournamentHubCards.filter((card) => !card.participantOnly);
  }

  const participantCards: TournamentHubCard[] = [
    {
      href: ROUTES.categories,
      title: "Roster groups",
      description: "View category labels and ordering used across the auction experience.",
    },
    {
      href: ROUTES.teams,
      title: "All Teams",
      description: "View all franchises and assigned owners in this tournament.",
    },
    {
      href: ROUTES.players,
      title: "All Players",
      description: "Browse the player pool with roster-group assignments.",
    },
    {
      href: ROUTES.rules,
      title: "Rules",
      description: "View roster-group pick limits used during auction validation.",
    },
    ...(options.showFixtures
      ? [
          {
            href: ROUTES.fixtures,
            title: "Fixtures",
            description: "View and manage tournament fixtures and results.",
          } satisfies TournamentHubCard,
        ]
      : []),
    ...(options.showFixtures
      ? [
          {
            href: ROUTES.leaderboard,
            title: "Knockout board",
            description: "See standings and all recorded match results in one read-only board.",
          } satisfies TournamentHubCard,
        ]
      : []),
    ...(options.showFixtures
      ? [
          {
            href: ROUTES.run,
            title: "Run tournament",
            description: "Update live match status, scores, winners, and standings.",
          } satisfies TournamentHubCard,
        ]
      : []),
    {
      href: ROUTES.tv,
      title: "Live roster board",
      description:
        "Hall & projector view: franchises, drafted players by group, spotlight, clock, and picks. Refreshes automatically.",
      primary: true,
    },
    ...tournamentHubCards.filter((card) => card.participantOnly),
  ];

  const auctionLive =
    options.draftPhase === DraftPhase.LIVE || options.draftPhase === DraftPhase.PAUSED;
  if (!auctionLive) {
    return participantCards;
  }

  return [
    ...participantCards,
    {
      href: ROUTES.draft,
      title: "Participate in auction",
      description: "Nominate players during live auction rounds when it is your team's turn.",
      primary: true,
    },
  ];
}
