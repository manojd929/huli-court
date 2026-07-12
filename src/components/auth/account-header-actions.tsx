"use client";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface AccountHeaderActionsProps {
  /** Classes on the wrapping flex container (e.g. alignment). */
  className?: string;
  /** Extra classes on the log out control (width/spacing on small screens). */
  signOutButtonClassName?: string;
}

/** Theme toggle immediately left of log out, grouped for every authenticated chrome bar. */
export function AccountHeaderActions({
  className,
  signOutButtonClassName,
}: AccountHeaderActionsProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-l border-transparent pl-0 sm:border-border/35 sm:pl-4 md:gap-2.5 md:pl-5",
        className,
      )}
    >
      <ThemeToggle />
      <SignOutButton
        className={cn("min-h-10 sm:min-h-11", signOutButtonClassName)}
        variant="outline"
      />
    </div>
  );
}
