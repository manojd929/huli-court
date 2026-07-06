import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountHeaderActions } from "@/components/auth/account-header-actions";
import { ROUTES } from "@/constants/app";
import { LeagueForm } from "@/features/leagues/league-form";
import { UserRole } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function NewLeaguePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/league/new");
  }
  const profile = await prisma.userProfile.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { role: true },
  });
  if (!profile || profile.role !== UserRole.ADMIN) {
    redirect(ROUTES.dashboard);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={ROUTES.dashboard} className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <AccountHeaderActions />
      </div>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight">Create a league</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        A league is a recurring, branded competition — a home for every season
        and tournament you run, with its own shareable public page.
      </p>
      <div className="mt-12">
        <LeagueForm />
      </div>
    </div>
  );
}
