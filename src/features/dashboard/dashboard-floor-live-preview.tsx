"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardFloorThemeOptions, type DashboardFloorTheme } from "@/constants/dashboard-theme";
import { cn } from "@/lib/utils";

import { DashboardFloorBackdropShell } from "./dashboard-floor-backdrop-layers";

export function DashboardFloorLivePreviewPanel({
  theme,
  hydrated,
}: {
  theme: DashboardFloorTheme;
  hydrated: boolean;
}) {
  const meta = dashboardFloorThemeOptions.find((opt) => opt.id === theme);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge variant="secondary">Live preview</Badge>
        <p className="text-sm text-muted-foreground">
          Active backdrop ·{" "}
          <span className="font-medium text-foreground">
            {hydrated ? (meta?.label ?? theme) : "…"}
          </span>
        </p>
      </div>

      {!hydrated ? (
        <Skeleton className="aspect-[21/10] w-full rounded-xl md:max-h-[220px]" />
      ) : (
        <DashboardFloorBackdropShell
          theme={theme}
          className={cn(
            "w-full rounded-xl border border-border/50 shadow-sm ring-1 ring-border/40",
            "aspect-[21/10] max-h-[220px] min-h-[148px]",
            "transition-[background] duration-500 ease-out motion-reduce:transition-none",
          )}
        >
          <div className="relative z-10 flex h-full flex-col rounded-[inherit]">
            <div className="flex items-center gap-3 border-b border-border/35 bg-background/50 px-3 py-2 backdrop-blur-sm">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Commissioner hub
              </span>
              <div className="ml-auto hidden h-1.5 w-16 rounded-full bg-muted sm:block" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:flex-row">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-2.5 max-w-[10rem] rounded-md bg-background/65 ring-1 ring-border/30" />
                <div className="h-[3.25rem] rounded-lg bg-background/50 ring-1 ring-border/30" />
                <div className="h-[3.25rem] rounded-lg bg-background/45 ring-1 ring-border/25" />
              </div>
              <div className="hidden shrink-0 basis-[26%] rounded-md bg-background/45 ring-1 ring-border/25 sm:block" />
            </div>
          </div>
        </DashboardFloorBackdropShell>
      )}
    </div>
  );
}
