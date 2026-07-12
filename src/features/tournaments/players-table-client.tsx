"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bulkUpdatePlayersAction } from "@/features/tournaments/actions";
import { DeletePlayerButton } from "@/features/tournaments/delete-player-button";
import { GrantFranchiseLoginDialog } from "@/features/tournaments/grant-franchise-login-dialog";
import { PlayerEditDialog } from "@/features/tournaments/player-edit-dialog";
import type { RosterCategorySelectOption } from "@/features/tournaments/players-quick-add";
import { RevokeFranchiseLoginButton } from "@/features/tournaments/revoke-franchise-login-button";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";

export interface PlayersTableRow {
  id: string;
  name: string;
  rosterCategoryId: string;
  rosterCategoryName: string;
  rosterCategoryColorHex: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  photoUrl: string | null;
  notes: string | null;
  linkedOwnerUserId: string | null;
  isUnavailable: boolean;
  isLocked: boolean;
  hasPaidEntryFee: boolean;
  basePrice: number | null;
}

interface PlayersTableClientProps {
  tournamentSlug: string;
  players: PlayersTableRow[];
  uploadsEnabled: boolean;
  selectableCategories: RosterCategorySelectOption[];
  isCommissioner: boolean;
  invitingSupported: boolean;
  canInviteOwners: boolean;
  emptyState: React.ReactNode;
}

type BulkPaymentStatus = "UNCHANGED" | "PAID" | "PENDING";

export function PlayersTableClient({
  tournamentSlug,
  players,
  uploadsEnabled,
  selectableCategories,
  isCommissioner,
  invitingSupported,
  canInviteOwners,
  emptyState,
}: PlayersTableClientProps) {
  const router = useRouter();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [bulkRosterCategoryId, setBulkRosterCategoryId] = useState("");
  const [bulkPaymentStatus, setBulkPaymentStatus] = useState<BulkPaymentStatus>("UNCHANGED");
  const [isApplying, setIsApplying] = useState(false);

  const allVisibleSelected = players.length > 0 && selectedPlayerIds.length === players.length;
  const bulkHasChanges = bulkRosterCategoryId !== "" || bulkPaymentStatus !== "UNCHANGED";

  const selectedCountLabel = useMemo(() => {
    if (selectedPlayerIds.length === 0) return "No players selected";
    if (selectedPlayerIds.length === 1) return "1 player selected";
    return `${selectedPlayerIds.length} players selected`;
  }, [selectedPlayerIds.length]);

  function togglePlayer(playerId: string): void {
    setSelectedPlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId],
    );
  }

  function toggleAllPlayers(): void {
    setSelectedPlayerIds(allVisibleSelected ? [] : players.map((player) => player.id));
  }

  async function applyBulkUpdate(): Promise<void> {
    if (selectedPlayerIds.length === 0 || !bulkHasChanges) {
      return;
    }

    setIsApplying(true);
    try {
      const result = await bulkUpdatePlayersAction({
        tournamentSlug,
        playerIds: selectedPlayerIds,
        ...(bulkRosterCategoryId ? { rosterCategoryId: bulkRosterCategoryId } : {}),
        ...(bulkPaymentStatus === "UNCHANGED"
          ? {}
          : { hasPaidEntryFee: bulkPaymentStatus === "PAID" }),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Bulk player update applied.");
      setSelectedPlayerIds([]);
      setBulkRosterCategoryId("");
      setBulkPaymentStatus("UNCHANGED");
      router.refresh();
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      {isCommissioner ? (
        <section className="rounded-xl border border-border/70 bg-card/35 p-4 backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight">Bulk edit players</h3>
              <p className="text-sm text-muted-foreground">
                {selectedCountLabel}. Update payment status, roster group, or both in one pass.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[34rem]">
              <label className="space-y-1">
                <span className="text-sm font-medium">Move to roster group</span>
                <select
                  value={bulkRosterCategoryId}
                  onChange={(event) => setBulkRosterCategoryId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Leave unchanged</option>
                  {selectableCategories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Entry fee status</span>
                <select
                  value={bulkPaymentStatus}
                  onChange={(event) =>
                    setBulkPaymentStatus(event.target.value as BulkPaymentStatus)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="UNCHANGED">Leave unchanged</option>
                  <option value="PAID">Mark as paid</option>
                  <option value="PENDING">Mark as pending</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={toggleAllPlayers}
              disabled={players.length === 0}
            >
              {allVisibleSelected ? "Clear selection" : "Select all"}
            </Button>
            <Button
              type="button"
              pending={isApplying}
              pendingLabel="Applying…"
              disabled={selectedPlayerIds.length === 0 || !bulkHasChanges}
              onClick={() => void applyBulkUpdate()}
            >
              Apply to selected
            </Button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/30 backdrop-blur-md">
        <Table>
          <TableHeader>
            <TableRow>
              {isCommissioner ? (
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllPlayers}
                    aria-label="Select all players"
                    className="size-4 rounded border-input"
                  />
                </TableHead>
              ) : null}
              <TableHead>Name</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Fee paid</TableHead>
              <TableHead>Status</TableHead>
              {isCommissioner ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isCommissioner ? 6 : 4} className="text-muted-foreground">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              players.map((player) => (
                <TableRow key={player.id}>
                  {isCommissioner ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.includes(player.id)}
                        onChange={() => togglePlayer(player.id)}
                        aria-label={`Select ${player.name}`}
                        className="size-4 rounded border-input"
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell className="align-middle">
                    <RosterCategoryPill
                      name={player.rosterCategoryName}
                      colorHex={player.rosterCategoryColorHex}
                    />
                  </TableCell>
                  <TableCell className="align-middle">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={player.hasPaidEntryFee}
                        readOnly
                        aria-label={`${player.name} entry fee paid`}
                        className="size-4 rounded border-input"
                      />
                      <span
                        className={
                          player.hasPaidEntryFee
                            ? "font-medium text-emerald-700 dark:text-emerald-300"
                            : "text-muted-foreground"
                        }
                      >
                        {player.hasPaidEntryFee ? "Paid" : "Pending"}
                      </span>
                    </label>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[
                      player.linkedOwnerUserId ? "Team owner" : null,
                      player.isUnavailable ? "Away" : null,
                      player.isLocked ? "Locked" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </TableCell>
                  {isCommissioner ? (
                    <TableCell className="align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <PlayerEditDialog
                          tournamentSlug={tournamentSlug}
                          uploadsEnabled={uploadsEnabled}
                          selectableCategories={selectableCategories}
                          compactTrigger
                          className="shrink-0"
                          player={{
                            id: player.id,
                            name: player.name,
                            rosterCategoryId: player.rosterCategoryId,
                            gender: player.gender,
                            photoUrl: player.photoUrl,
                            notes: player.notes,
                            hasPaidEntryFee: player.hasPaidEntryFee,
                            basePrice: player.basePrice,
                          }}
                        />
                        {player.linkedOwnerUserId ? (
                          <RevokeFranchiseLoginButton
                            tournamentSlug={tournamentSlug}
                            playerId={player.id}
                            playerName={player.name}
                            canInviteOwners={canInviteOwners}
                          />
                        ) : (
                          <GrantFranchiseLoginDialog
                            tournamentSlug={tournamentSlug}
                            playerId={player.id}
                            playerName={player.name}
                            invitingSupported={invitingSupported}
                            canInviteOwners={canInviteOwners}
                            className="min-h-8 shrink-0"
                          />
                        )}
                        <DeletePlayerButton
                          tournamentSlug={tournamentSlug}
                          playerId={player.id}
                          playerName={player.name}
                          compact
                          className="shrink-0"
                          disabled={player.linkedOwnerUserId !== null}
                          disabledReason={
                            player.linkedOwnerUserId !== null
                              ? "Revoke franchise login first (or remove them on Teams), then you can delete this roster row."
                              : undefined
                          }
                        />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
