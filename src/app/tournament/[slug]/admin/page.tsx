import { notFound, redirect } from "next/navigation";

import { AdminControlRoomClient } from "@/components/draft/admin-control-room-client";
import { AuctionDeskClient } from "@/components/draft/auction-desk-client";
import { RandomAssignmentPanel } from "@/components/draft/random-assignment-panel";
import { AdminRosterGroupsBrief } from "@/features/tournaments/admin-roster-groups-brief";
import { getSessionUser } from "@/lib/auth/session";
import { getTournamentBySlug } from "@/lib/data/tournament-access";
import { fetchDraftSnapshotBySlug } from "@/services/draft-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminControlRoomPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/admin`);
  }

  const tournament = await getTournamentBySlug(slug);
  if (!tournament) {
    notFound();
  }
  if (tournament.createdById !== user.id) {
    redirect(`/tournament/${slug}`);
  }

  const snapshot = await fetchDraftSnapshotBySlug(slug);
  if (!snapshot) {
    notFound();
  }

  const headline =
    snapshot.allocationMethod === "LIVE_AUCTION"
      ? {
          title: "Run the live auction",
          blurb:
            "Open a lot, let owners bid from their phones, then bang the hammer. Sold squads flow straight into rosters and fixtures.",
        }
      : snapshot.allocationMethod === "RANDOM_ASSIGNMENT"
        ? {
            title: "Assign teams",
            blurb:
              "One tap shuffles every available player into balanced squads that respect your roster-group caps.",
          }
        : {
            title: "Run the draft",
            blurb:
              "Shuffle franchise order once, then go live. When an owner submits a nominee, you will confirm it or decline and keep drafting. HuliCourt advances the picks for you.",
          };

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
          {headline.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {headline.blurb}
        </p>
      </header>
      <AdminRosterGroupsBrief tournamentSlug={slug} />

      {snapshot.allocationMethod === "LIVE_AUCTION" ? (
        <AuctionDeskClient slug={slug} initialSnapshot={snapshot} />
      ) : snapshot.allocationMethod === "RANDOM_ASSIGNMENT" ? (
        <RandomAssignmentPanel slug={slug} initialSnapshot={snapshot} />
      ) : (
        <AdminControlRoomClient slug={slug} initialSnapshot={snapshot} viewerUserId={user.id} />
      )}
    </div>
  );
}
