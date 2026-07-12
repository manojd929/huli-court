import Link from "next/link";

import { AccountHeaderActions } from "@/components/auth/account-header-actions";
import { ROUTES } from "@/constants/app";
import { DashboardFloorAppearanceSettingsCard } from "@/features/dashboard/dashboard-floor-appearance-settings";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
        <Link
          href={ROUTES.dashboard}
          className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground"
        >
          ← Tournaments
        </Link>
        <AccountHeaderActions />
      </div>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-balance">Settings</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-pretty text-muted-foreground">
        Commissioner preferences live here alongside workspace appearance. More profile and
        notification options are on the roadmap.
      </p>

      <div className="mt-10 space-y-6">
        <DashboardFloorAppearanceSettingsCard />
      </div>

      <p className="mt-10 border-t border-border/40 pt-8 text-xs leading-relaxed text-muted-foreground">
        Your backdrop choice saves on this browser. Open the commissioner dashboard anytime; the
        updated floor palette applies immediately.
      </p>
    </div>
  );
}
