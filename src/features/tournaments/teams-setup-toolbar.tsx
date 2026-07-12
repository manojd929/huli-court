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
import { InviteOwnerPanel } from "@/features/tournaments/invite-owner-panel";
import type { AssignablePerson } from "@/features/tournaments/owner-picker";
import { TeamsQuickAdd } from "@/features/tournaments/teams-quick-add";

interface TeamsSetupToolbarProps {
  tournamentSlug: string;
  invitingSupported: boolean;
  canInviteOwners: boolean;
  assignablePeople: AssignablePerson[];
  uploadsEnabled: boolean;
}

export function TeamsSetupToolbar({
  tournamentSlug,
  invitingSupported,
  canInviteOwners,
  assignablePeople,
  uploadsEnabled,
}: TeamsSetupToolbarProps) {
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <Link
        href={ROUTES.categories(tournamentSlug)}
        className="mr-auto text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Roster groups →
      </Link>
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetTrigger
          type="button"
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
        >
          Provision owner login
        </SheetTrigger>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md md:max-w-lg">
          <SheetHeader className="border-b border-border/60 pb-4">
            <SheetTitle>Optional owner login</SheetTitle>
            <SheetDescription>
              Create a standalone franchise-owner account before a roster row exists. Prefer Players
              → <span className="font-medium text-foreground">Add player</span> → Grant login when
              you can.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <InviteOwnerPanel
              tournamentSlug={tournamentSlug}
              invitingSupported={invitingSupported}
              canInviteOwners={canInviteOwners}
              variant="plain"
              onCreated={() => setInviteOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={addTeamOpen} onOpenChange={setAddTeamOpen}>
        <SheetTrigger
          type="button"
          className={cn(buttonVariants({ variant: "default" }), "min-h-11")}
        >
          Add franchise
        </SheetTrigger>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md lg:max-w-xl">
          <SheetHeader className="border-b border-border/60 pb-4">
            <SheetTitle>Add franchise</SheetTitle>
            <SheetDescription>
              Name the team, pick an owner from people you have already invited, then refine logo
              and colors if needed.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <TeamsQuickAdd
              tournamentSlug={tournamentSlug}
              assignablePeople={assignablePeople}
              uploadsEnabled={uploadsEnabled}
              variant="plain"
              onCreated={() => setAddTeamOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
