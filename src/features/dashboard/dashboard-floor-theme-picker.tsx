"use client";

import { ChevronDownIcon, Layers2Icon } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardFloorThemeOptions } from "@/constants/dashboard-theme";

import { useDashboardAppearance } from "./dashboard-appearance-provider";

export function DashboardFloorThemePicker({
  triggerClassName,
}: {
  /** Optional styling for compact toolbars vs settings cards. */
  triggerClassName?: string;
}) {
  const { hydrated, floorTheme, setFloorTheme } = useDashboardAppearance();
  const selected = dashboardFloorThemeOptions.find((o) => o.id === floorTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "default" }),
          "h-10 min-h-10 touch-manipulation justify-between gap-2 px-3 sm:min-h-9 sm:w-full sm:max-w-[18rem]",
          triggerClassName,
        )}
        aria-label="Floor backdrop appearance"
        aria-haspopup="menu"
        aria-busy={!hydrated ? true : undefined}
        disabled={!hydrated}
      >
        {hydrated ? (
          <Layers2Icon className="size-4 shrink-0 opacity-75" aria-hidden />
        ) : (
          <Spinner className="size-4 opacity-75" />
        )}
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
          {hydrated ? (selected?.label ?? "Backdrop") : "Loading themes…"}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[min(22rem,calc(100vw-2rem))] p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Dashboard floor backdrop
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={floorTheme}
            onValueChange={(value) => {
              const next = dashboardFloorThemeOptions.find((o) => o.id === value);
              if (next) setFloorTheme(next.id);
            }}
            className="flex flex-col gap-0.5"
          >
            {dashboardFloorThemeOptions.map((opt) => (
              <DropdownMenuRadioItem
                key={opt.id}
                value={opt.id}
                disabled={!hydrated}
                className="flex cursor-pointer flex-col gap-1 py-2 pr-10 pl-2"
              >
                <span className="font-medium text-foreground">{opt.label}</span>
                <span className="text-xs leading-snug font-normal text-muted-foreground">
                  {opt.hint}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
