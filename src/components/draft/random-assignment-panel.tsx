"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runRandomAssignmentAction } from "@/features/draft/actions";
import { useDraftLiveSync } from "@/hooks/use-draft-live-sync";
import type { DraftSnapshotDto } from "@/types/draft";

interface RandomAssignmentPanelProps {
  slug: string;
  initialSnapshot: DraftSnapshotDto;
}

export function RandomAssignmentPanel({ slug, initialSnapshot }: RandomAssignmentPanelProps) {
  const [snapshot, setSnapshot] = useState<DraftSnapshotDto>(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const { refresh } = useDraftLiveSync(slug, snapshot.tournamentId, setSnapshot);

  const eligibleCount = useMemo(
    () =>
      snapshot.players.filter(
        (player) =>
          player.assignedTeamId === null &&
          !player.runsFranchiseLogin &&
          !player.isUnavailable &&
          !player.isLocked,
      ).length,
    [snapshot.players],
  );

  const completed = snapshot.draftPhase === "COMPLETED";

  const run = async () => {
    setBusy(true);
    try {
      const result = await runRandomAssignmentAction({ tournamentSlug: slug });
      if (!result.ok) {
        toast.error(result.error ?? "Random assignment failed.");
      } else {
        const { assignedCount, unassignedCount } = result.data ?? {
          assignedCount: 0,
          unassignedCount: 0,
        };
        toast.success(
          unassignedCount > 0
            ? `${assignedCount} players assigned; ${unassignedCount} did not fit under the squad rules.`
            : `${assignedCount} players assigned. Teams are set!`,
        );
      }
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Random assignment</CardTitle>
        <CardDescription>
          {completed
            ? "Teams have been assigned. Head to fixtures."
            : `One tap assigns ${eligibleCount} available players evenly across ${snapshot.teams.length} teams, respecting roster-group caps. Owner-linked players keep their teams.`}
        </CardDescription>
      </CardHeader>
      {!completed && (
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger
              render={(props) => (
                <Button {...props} disabled={busy || snapshot.teams.length === 0} size="lg">
                  Run random assignment
                </Button>
              )}
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Assign teams now?</AlertDialogTitle>
                <AlertDialogDescription>
                  This shuffles all {eligibleCount} available players into {snapshot.teams.length}{" "}
                  teams and completes the allocation phase. You can still fine-tune squads
                  afterwards with manual assignment.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not yet</AlertDialogCancel>
                <AlertDialogAction onClick={run}>Shuffle &amp; assign</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      )}
    </Card>
  );
}
