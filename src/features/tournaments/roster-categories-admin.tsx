"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RosterCategoryPill } from "@/features/roster/roster-category-pill";
import {
  archiveRosterCategoryAction,
  createRosterCategoryAction,
  moveRosterCategoryOrderAction,
  restoreRosterCategoryAction,
  updateRosterCategoryAction,
} from "@/features/tournaments/actions";
import { ROUTES } from "@/constants/app";
import { cn } from "@/lib/utils";

export interface RosterCategoryAdminRow {
  id: string;
  name: string;
  displayOrder: number;
  colorHex: string | null;
  archivedAt: string | null;
}

interface RosterCategoriesAdminProps {
  tournamentSlug: string;
  canManageCategories: boolean;
  categories: RosterCategoryAdminRow[];
}

export function RosterCategoriesAdmin({
  tournamentSlug,
  canManageCategories,
  categories,
}: RosterCategoriesAdminProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<RosterCategoryAdminRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RosterCategoryAdminRow | null>(null);
  const [reorderBusyId, setReorderBusyId] = useState<string | null>(null);
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);

  const activeCategories = categories.filter((c) => c.archivedAt === null);
  const archivedCategories = categories.filter((c) => c.archivedAt !== null);

  return (
    <div className="space-y-4">
      {!canManageCategories ? (
        <p className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Roster groups are read-only once the auction configuration is sealed. Player categories
          and pills on the auction board stay as they were at go-live.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href={ROUTES.players(tournamentSlug)}
            className="mr-auto text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Players → add athletes
          </Link>
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger
              type="button"
              className={cn(buttonVariants({ variant: "default" }), "min-h-11")}
            >
              New roster group
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-0 sm:max-w-md md:max-w-lg">
              <SheetHeader className="border-b border-border/60 pb-4">
                <SheetTitle>New roster group</SheetTitle>
                <SheetDescription>
                  Player creation and squad rules reference these labels. Tune display order so
                  filters and admin tables stay consistent everywhere.
                </SheetDescription>
              </SheetHeader>
              <CategoryCreateForm
                tournamentSlug={tournamentSlug}
                onDone={() => {
                  setCreateOpen(false);
                  router.refresh();
                }}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/30 backdrop-blur-md">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="border-b border-border/60 bg-muted/20">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Group</th>
              <th className="px-4 py-3 text-left font-medium">Display priority</th>
              {canManageCategories ? (
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {activeCategories.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-muted-foreground"
                  colSpan={canManageCategories ? 3 : 2}
                >
                  No roster groups configured.
                </td>
              </tr>
            ) : (
              activeCategories.map((row, index) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 align-middle">
                    <RosterCategoryPill name={row.name} colorHex={row.colorHex} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground tabular-nums">
                      <span>{row.displayOrder}</span>
                      {canManageCategories ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 touch-manipulation"
                            disabled={reorderBusyId === row.id || index <= 0}
                            aria-label={`Move ${row.name} up in filters and tables`}
                            onClick={() =>
                              void (async (): Promise<void> => {
                                setReorderBusyId(row.id);
                                try {
                                  const res = await moveRosterCategoryOrderAction({
                                    tournamentSlug,
                                    rosterCategoryId: row.id,
                                    direction: "up",
                                  });
                                  if (!res.ok) {
                                    toast.error(res.error);
                                    return;
                                  }
                                  router.refresh();
                                } finally {
                                  setReorderBusyId(null);
                                }
                              })()
                            }
                          >
                            <ArrowUp className="size-4 shrink-0" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 touch-manipulation"
                            disabled={
                              reorderBusyId === row.id || index >= activeCategories.length - 1
                            }
                            aria-label={`Move ${row.name} down in filters and tables`}
                            onClick={() =>
                              void (async (): Promise<void> => {
                                setReorderBusyId(row.id);
                                try {
                                  const res = await moveRosterCategoryOrderAction({
                                    tournamentSlug,
                                    rosterCategoryId: row.id,
                                    direction: "down",
                                  });
                                  if (!res.ok) {
                                    toast.error(res.error);
                                    return;
                                  }
                                  router.refresh();
                                } finally {
                                  setReorderBusyId(null);
                                }
                              })()
                            }
                          >
                            <ArrowDown className="size-4 shrink-0" aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  {canManageCategories ? (
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9"
                          onClick={() => setEditRow(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9"
                          onClick={() => setArchiveTarget(row)}
                        >
                          Archive
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {archivedCategories.length > 0 ? (
        <section className="rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5">
          <h3 className="text-sm font-semibold tracking-tight">Archived</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Archived groups are hidden from player pickers until you restore them. Pick limits on
            the Squad rules page still reflect each group&apos;s last saved cap once restored.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {archivedCategories.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/35 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <RosterCategoryPill
                    name={row.name}
                    colorHex={row.colorHex}
                    className="opacity-80"
                  />
                  <span className="text-muted-foreground tabular-nums">
                    Saved order · {String(row.displayOrder)}
                  </span>
                </div>
                {canManageCategories ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    pending={restoreBusyId === row.id}
                    pendingLabel="Restoring…"
                    disabled={restoreBusyId !== null}
                    onClick={() =>
                      void (async (): Promise<void> => {
                        setRestoreBusyId(row.id);
                        try {
                          const res = await restoreRosterCategoryAction({
                            tournamentSlug,
                            rosterCategoryId: row.id,
                          });
                          if (!res.ok) {
                            toast.error(res.error);
                            return;
                          }
                          toast.success(`${row.name} is active again.`);
                          router.refresh();
                        } finally {
                          setRestoreBusyId(null);
                        }
                      })()
                    }
                  >
                    Restore
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editRow && canManageCategories ? (
        <CategoryEditDialog
          tournamentSlug={tournamentSlug}
          row={editRow}
          open={Boolean(editRow)}
          onOpenChange={(open) => {
            if (!open) setEditRow(null);
          }}
          onSaved={() => {
            setEditRow(null);
            router.refresh();
          }}
        />
      ) : null}

      {archiveTarget && canManageCategories ? (
        <ArchiveCategoryDialog
          tournamentSlug={tournamentSlug}
          row={archiveTarget}
          open={Boolean(archiveTarget)}
          onOpenChange={(open) => {
            if (!open) setArchiveTarget(null);
          }}
          onArchived={() => {
            setArchiveTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryCreateForm({
  tournamentSlug,
  onDone,
}: {
  tournamentSlug: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [colorHex, setColorHex] = useState("#64748b");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const result = await createRosterCategoryAction({
        tournamentSlug,
        name: name.trim(),
        ...(displayOrder.trim() !== "" ? { displayOrder: Number(displayOrder) } : {}),
        colorHex: colorHex.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setDisplayOrder("");
      setColorHex("#64748b");
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="space-y-2">
        <Label htmlFor="new-cat-name">Label</Label>
        <Input
          id="new-cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
          maxLength={120}
          placeholder="Mixed Doubles"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-cat-order">Display order (optional)</Label>
        <Input
          id="new-cat-order"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          type="number"
          min={0}
          max={999}
          placeholder="Auto next"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-cat-color">Pill color</Label>
        <input
          id="new-cat-color"
          type="color"
          value={colorHex}
          onChange={(e) => setColorHex(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        pending={pending}
        pendingLabel="Saving…"
        className="min-h-11 w-full sm:w-auto"
        onClick={() => void handleSubmit()}
      >
        Save group
      </Button>
    </div>
  );
}

function CategoryEditDialog({
  tournamentSlug,
  row,
  open,
  onOpenChange,
  onSaved,
}: {
  tournamentSlug: string;
  row: RosterCategoryAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [displayOrder, setDisplayOrder] = useState(String(row.displayOrder));
  const [colorHex, setColorHex] = useState(row.colorHex ?? "#64748b");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function syncFromProps(): void {
    setName(row.name);
    setDisplayOrder(String(row.displayOrder));
    setColorHex(row.colorHex ?? "#64748b");
    setError(null);
  }

  async function handleSave(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const orderNum = Number(displayOrder);
      if (!Number.isFinite(orderNum)) {
        setError("Display order must be a number.");
        return;
      }
      const result = await updateRosterCategoryAction({
        tournamentSlug,
        rosterCategoryId: row.id,
        name: name.trim(),
        displayOrder: orderNum,
        colorHex: colorHex.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      key={row.id}
      open={open}
      onOpenChange={(next) => {
        if (next) syncFromProps();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit roster group</DialogTitle>
          <DialogDescription>
            Names and colors show as pills wherever players surface.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="space-y-2">
            <Label htmlFor={`edit-cat-${row.id}`}>Label</Label>
            <Input
              id={`edit-cat-${row.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={1}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-order-${row.id}`}>Display order</Label>
            <Input
              id={`edit-order-${row.id}`}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              type="number"
              min={0}
              max={999}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-color-${row.id}`}>Pill color</Label>
            <input
              id={`edit-color-${row.id}`}
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
            />
          </div>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            pending={pending}
            pendingLabel="Saving…"
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveCategoryDialog({
  tournamentSlug,
  row,
  open,
  onOpenChange,
  onArchived,
}: {
  tournamentSlug: string;
  row: RosterCategoryAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmArchive(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const result = await archiveRosterCategoryAction({
        tournamentSlug,
        rosterCategoryId: row.id,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onArchived();
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md" size="default">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this roster group?</AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            <span className="font-semibold text-foreground">{row.name}</span> will disappear from
            assignment pickers. Archive only after moving every player elsewhere and keeping another
            active group.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            className="min-h-11 touch-manipulation"
            pending={pending}
            pendingLabel="Archiving…"
            onClick={(event) => {
              event.preventDefault();
              void confirmArchive();
            }}
          >
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
