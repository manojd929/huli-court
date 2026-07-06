import { TournamentShellHeader } from "@/components/navigation/tournament-shell-header";
import { notFound } from "next/navigation";

import { TournamentThemeShell } from "@/features/tournament-shell/tournament-theme-shell";
import { getTournamentBySlug } from "@/lib/data/tournament-access";
import {
  tournamentChromeNavGroups,
  type TournamentChromeNavViewer,
} from "@/lib/navigation/tournament-nav-links";
import { getSessionUser } from "@/lib/auth/session";

interface TournamentLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function TournamentLayout({
  children,
  params,
}: TournamentLayoutProps) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const user = await getSessionUser();
  const chromeViewer: TournamentChromeNavViewer =
    user?.id === tournament.createdById ? "commissioner" : "participant";
  const showFixtures = tournament.draftPhase === "COMPLETED";
  const navGroups = tournamentChromeNavGroups(slug, chromeViewer, { showFixtures });

  return (
    <TournamentThemeShell tournamentColorHex={tournament.colorHex}>
      <TournamentShellHeader
        slug={slug}
        tournamentName={tournament.name}
        tournamentLogoUrl={tournament.logoUrl}
        tournamentColorHex={tournament.colorHex}
        sport={tournament.sport}
        draftPhase={tournament.draftPhase}
        navGroups={navGroups}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="py-6 sm:py-10">{children}</div>
      </div>
    </TournamentThemeShell>
  );
}
