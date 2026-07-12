"use client";

import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/app";
import { cn } from "@/lib/utils";
import {
  PlayersQuickAdd,
  type RosterCategorySelectOption,
} from "@/features/tournaments/players-quick-add";

interface PlayersSetupToolbarProps {
  tournamentSlug: string;
  uploadsEnabled: boolean;
  selectableCategories: RosterCategorySelectOption[];
  defaultRosterCategoryId: string;
}

export function PlayersSetupToolbar({
  tournamentSlug,
  uploadsEnabled,
  selectableCategories,
  defaultRosterCategoryId,
}: PlayersSetupToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const canAddPlayers = selectableCategories.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href={ROUTES.categories(tournamentSlug)}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Manage roster groups →
      </Link>
      {canAddPlayers ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            type="button"
            className={cn(buttonVariants({ variant: "default" }), "min-h-11")}
          >
            Add player
          </SheetTrigger>
          <SheetContent side="right" className="w-full gap-0 sm:max-w-md md:max-w-lg">
            <SheetHeader className="border-b border-border/60 pb-4">
              <SheetTitle>Add player</SheetTitle>
              <SheetDescription>
                Capture roster details privately on this desk; share credentials outside HuliCourt
                when you invite franchise owners.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <PlayersQuickAdd
                tournamentSlug={tournamentSlug}
                uploadsEnabled={uploadsEnabled}
                selectableCategories={selectableCategories}
                defaultRosterCategoryId={defaultRosterCategoryId}
                variant="plain"
                onCreated={() => setSheetOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Link
          href={ROUTES.categories(tournamentSlug)}
          className={cn(buttonVariants({ variant: "default" }), "inline-flex min-h-11")}
        >
          Add roster groups first
        </Link>
      )}
    </div>
  );
}
