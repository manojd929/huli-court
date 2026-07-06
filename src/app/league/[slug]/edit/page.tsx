import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountHeaderActions } from "@/components/auth/account-header-actions";
import { ROUTES } from "@/constants/app";
import { LeagueForm } from "@/features/leagues/league-form";
import { getSessionUser } from "@/lib/auth/session";
import { getLeagueBySlug, userCanManageLeague } from "@/services/league-service";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditLeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/edit`);
  }
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (!(await userCanManageLeague(user.id, { organizationId: league.organizationId }))) {
    redirect(ROUTES.league(slug));
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={ROUTES.league(slug)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to league
        </Link>
        <AccountHeaderActions />
      </div>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight">Edit league</h1>
      <div className="mt-12">
        <LeagueForm
          existing={{
            slug: league.slug,
            name: league.name,
            description: league.description,
            logoUrl: league.logoUrl,
            colorHex: league.colorHex,
          }}
        />
      </div>
    </div>
  );
}
