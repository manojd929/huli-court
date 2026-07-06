import { notFound, redirect } from "next/navigation";

import { AuctionRoomClient } from "@/components/draft/auction-room-client";
import { DraftRoomClient } from "@/components/draft/draft-room-client";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { fetchDraftSnapshotBySlug } from "@/services/draft-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DraftFloorPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/draft`);
  }

  const tournament = await requireTournamentViewAccess(slug, user.id);
  const snapshot = await fetchDraftSnapshotBySlug(slug);
  if (!snapshot) {
    notFound();
  }

  const franchiseOwnerPhoneMode = user.id !== tournament.createdById;

  if (snapshot.allocationMethod === "LIVE_AUCTION") {
    return (
      <div className="space-y-4 sm:space-y-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            Auction floor
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            When a player goes under the hammer, tap{" "}
            <span className="font-medium text-foreground">Bid</span> to raise.
            Watch your purse — the organizer bangs the hammer.
          </p>
        </header>
        <AuctionRoomClient
          slug={slug}
          initialSnapshot={snapshot}
          viewerUserId={user.id}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
          Draft board
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Filter by group or sort the list. When it is your team&apos;s turn, tap{" "}
          <span className="font-medium text-foreground">Pick this player</span>. The organizer
          confirms each choice on the Admin screen.
        </p>
      </header>
      <DraftRoomClient
        slug={slug}
        initialSnapshot={snapshot}
        viewerUserId={user.id}
        enableOwnerPick
        franchiseOwnerPhoneMode={franchiseOwnerPhoneMode}
      />
    </div>
  );
}
