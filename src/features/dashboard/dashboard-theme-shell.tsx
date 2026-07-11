"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

import { AccountHeaderActions } from "@/components/auth/account-header-actions";
import { ROUTES } from "@/constants/app";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useDashboardAppearance } from "./dashboard-appearance-provider";
import { DashboardFloorBackdropShell } from "./dashboard-floor-backdrop-layers";

export function DashboardThemeShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { floorTheme } = useDashboardAppearance();

  return (
    <DashboardFloorBackdropShell
      theme={floorTheme}
      className={cn(
        "min-h-screen overflow-x-hidden",
        "transition-[background] duration-500 ease-out motion-reduce:transition-none",
      )}
    >
      <header className="border-b border-border/40 bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-2.5 md:gap-x-5 md:px-6 md:py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-8">
            <Link
              href={ROUTES.settings}
              prefetch={true}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "inline-flex touch-manipulation items-center gap-2 px-3 shadow-none",
                "min-h-10 rounded-lg ring-1 ring-border/35 transition-[background,box-shadow,ring-color,transform]",
                "hover:bg-secondary/95 hover:text-foreground hover:ring-border/55",
                "active:translate-y-px active:brightness-[0.98]",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#09090b]",
              )}
            >
              <Settings
                strokeWidth={2}
                className="size-[1.0625rem] shrink-0 text-foreground/80 sm:size-4 dark:text-foreground/85"
                aria-hidden
              />
              <span className="text-[0.8rem] font-medium sm:text-sm">Settings</span>
            </Link>
          </div>
          <AccountHeaderActions />
        </div>
      </header>

      {/* <main> gives the page a single content landmark and nests the page's
          own hero <header> inside it so it is not exposed as a second banner. */}
      <main className="relative z-10">{children}</main>
    </DashboardFloorBackdropShell>
  );
}
