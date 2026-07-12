"use client";

import { MoonIcon, SunIcon, SunMoonIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useAppTheme, useResolvedTheme } from "@/components/app-theme-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

const subscribeNothing = (): (() => void) => (): void => {};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const clientReady = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  const { theme, setTheme } = useAppTheme();
  const resolved = useResolvedTheme();

  const appearanceLabel =
    resolved === "dark"
      ? "Appearance: dark mode is on, change theme"
      : "Appearance: light mode is on, change theme";

  if (!clientReady) {
    /** Avoid Base UI dropdown trigger SSR/client subtree mismatches; matches default provider theme (dark). */
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        aria-busy
        aria-label="Appearance menu loading…"
        className={cn(
          "size-10 min-h-10 min-w-10 shrink-0 touch-manipulation rounded-full border border-border/25 bg-background/55 text-muted-foreground opacity-85 shadow-none",
          "dark:border-white/14 dark:bg-white/[0.05]",
          className,
        )}
      >
        <MoonIcon className="size-[1.2rem] shrink-0 stroke-[2.35]" aria-hidden />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-10 min-h-10 min-w-10 shrink-0 touch-manipulation rounded-full border border-border/25 bg-background/55 text-muted-foreground shadow-none",
          "transition-[background,color,box-shadow,border-color]",
          "hover:border-border/50 hover:bg-accent/65 hover:text-foreground",
          "data-[popup-open]:border-primary/35 data-[popup-open]:bg-accent/75 data-[popup-open]:text-foreground",
          "dark:border-white/14 dark:bg-white/[0.05] dark:hover:border-white/[0.26] dark:hover:bg-white/[0.08]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "motion-reduce:transition-none",
          className,
        )}
        aria-label={appearanceLabel}
        aria-haspopup="menu"
      >
        {resolved === "dark" ? (
          <MoonIcon className="size-[1.2rem] shrink-0 stroke-[2.35]" aria-hidden />
        ) : (
          <SunIcon
            className="size-[1.2rem] shrink-0 stroke-[2.35] text-amber-600 dark:text-amber-300/95"
            aria-hidden
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        <div role="group" aria-labelledby="theme-appearance-heading">
          <div
            id="theme-appearance-heading"
            className="px-1.5 py-1 text-xs font-medium text-muted-foreground"
          >
            Appearance
          </div>
          <DropdownMenuRadioGroup
            aria-labelledby="theme-appearance-heading"
            value={theme}
            onValueChange={(value) => {
              if (value === "light" || value === "dark" || value === "system") {
                queueMicrotask(() => {
                  setTheme(value);
                });
              }
            }}
          >
            <DropdownMenuRadioItem value="light" closeOnClick className="gap-2">
              <SunIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
                strokeWidth={2.25}
              />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" closeOnClick className="gap-2">
              <MoonIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
                strokeWidth={2.25}
              />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system" closeOnClick className="gap-2">
              <SunMoonIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
                strokeWidth={2.25}
              />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
