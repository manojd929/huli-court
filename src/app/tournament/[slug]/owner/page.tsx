import { redirect } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import { PickStatus } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { requireTournamentViewAccess } from "@/lib/data/tournament-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OwnerViewPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/tournament/${slug}/owner`);
  }

  const tournament = await requireTournamentViewAccess(slug, user.id);

  const team = await prisma.team.findFirst({
    where: {
      tournamentId: tournament.id,
      ownerUserId: user.id,
      deletedAt: null,
    },
    select: { id: true, name: true, shortName: true },
  });

  if (!team) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">My Team</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            No franchise is assigned to this login in this tournament yet.
          </p>
        </header>
      </div>
    );
  }

  const picks = await prisma.pick.findMany({
    where: {
      tournamentId: tournament.id,
      teamId: team.id,
      status: PickStatus.CONFIRMED,
    },
    orderBy: [{ slotIndex: "asc" }],
    select: {
      slotIndex: true,
      player: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          rosterCategory: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  const ownerLinkedRows = await prisma.player.findMany({
    where: {
      tournamentId: tournament.id,
      deletedAt: null,
      linkedOwnerUserId: user.id,
    },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      rosterCategory: { select: { name: true, colorHex: true } },
    },
  });

  const rosterCards = [
    ...ownerLinkedRows.map((player) => ({
      id: `owner-${player.id}`,
      label: "Owner row",
      playerName: player.name,
      photoUrl: player.photoUrl,
      rosterCategoryName: player.rosterCategory.name,
      rosterCategoryColorHex: player.rosterCategory.colorHex,
    })),
    ...picks.map((pick) => ({
      id: `pick-${pick.player.id}-${pick.slotIndex}`,
      label: `Pick ${pick.slotIndex + 1}`,
      playerName: pick.player.name,
      photoUrl: pick.player.photoUrl,
      rosterCategoryName: pick.player.rosterCategory.name,
      rosterCategoryColorHex: null,
    })),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">My Team</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Confirmed roster for {team.shortName ?? team.name}, including the assigned owner row.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rosterCards.length === 0 ? (
          <p className="text-muted-foreground">No confirmed roster slots yet.</p>
        ) : null}
        {rosterCards.map((item) => (
          <Card key={item.id} className="border-border/70 bg-card/50 backdrop-blur-sm">
            <CardContent className="space-y-2 p-4">
              <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border/60 bg-muted/35">
                {item.photoUrl ? (
                  <Image
                    src={item.photoUrl}
                    alt={item.playerName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                    {item.playerName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="text-base font-semibold">{item.playerName}</p>
              <RosterCategoryPill
                name={item.rosterCategoryName}
                colorHex={item.rosterCategoryColorHex}
                className="max-w-max"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
