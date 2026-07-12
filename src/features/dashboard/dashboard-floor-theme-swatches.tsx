"use client";

import { CheckIcon } from "lucide-react";

import {
  dashboardFloorThemeOptions,
  dashboardFloorThemeSwatchBannerClass,
  type DashboardFloorTheme,
} from "@/constants/dashboard-theme";
import { cn } from "@/lib/utils";

interface DashboardFloorThemeSwatchesProps {
  selectedTheme: DashboardFloorTheme;
  onSelect: (theme: DashboardFloorTheme) => void;
  disabled?: boolean;
}

export function DashboardFloorThemeSwatches({
  selectedTheme,
  onSelect,
  disabled = false,
}: DashboardFloorThemeSwatchesProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5"
      role="radiogroup"
      aria-label="Commissioner dashboard floor theme"
    >
      {dashboardFloorThemeOptions.map((opt) => {
        const active = selectedTheme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onSelect(opt.id)}
            className={cn(
              "group relative flex min-h-[10.75rem] touch-manipulation flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all outline-none",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/55",
              "enabled:hover:border-primary/35 enabled:hover:shadow-md",
              active
                ? "border-primary/80 ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "border-border/60",
              disabled && "opacity-60",
            )}
          >
            <span className={cn(dashboardFloorThemeSwatchBannerClass[opt.id])} aria-hidden />
            <span className="flex flex-1 flex-col gap-1 p-3">
              <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                {opt.label}
                <CheckIcon
                  className={cn(
                    "ml-auto size-4 shrink-0 text-primary opacity-0 transition-opacity",
                    active && "opacity-100",
                  )}
                  aria-hidden
                />
              </span>
              <span className="line-clamp-3 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                {opt.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
