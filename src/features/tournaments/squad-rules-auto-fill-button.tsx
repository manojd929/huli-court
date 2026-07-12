"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncSquadRulesToRosterAction } from "@/features/tournaments/actions";

interface SquadRulesAutoFillButtonProps {
  tournamentSlug: string;
}

export function SquadRulesAutoFillButton({ tournamentSlug }: SquadRulesAutoFillButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      className="min-h-10"
      onClick={() => {
        startTransition(async () => {
          const result = await syncSquadRulesToRosterAction({ tournamentSlug });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Pick limits updated from player counts and teams.");
          router.refresh();
        });
      }}
    >
      {pending ? "Calculating…" : "Auto-set limits from roster"}
    </Button>
  );
}
