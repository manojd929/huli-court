"use client";

import { useCallback, useEffect, useRef } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DraftSnapshotDto } from "@/types/draft";

/** Polling cadence when picks are live (or paused mid-auction). */
export const DRAFT_POLL_INTERVAL_FAST_MS = 1150;
/** Polling when the board is idle (setup, locked, completed). */
export const DRAFT_POLL_INTERVAL_SLOW_MS = 4600;

async function fetchSnapshot(slug: string): Promise<DraftSnapshotDto | null> {
  const response = await fetch(`/api/tournaments/${slug}/snapshot`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<DraftSnapshotDto>;
}

export interface DraftLiveSyncOptions {
  enabled?: boolean;
  /** Faster polling for LIVE/PAUSED auctions; slower otherwise. */
  accelerated?: boolean;
}

/**
 * Polling plus optional Supabase Realtime when `Tournament` replication is enabled.
 */
export function useDraftLiveSync(
  slug: string,
  tournamentId: string | undefined,
  onUpdate: (snapshot: DraftSnapshotDto) => void,
  options: DraftLiveSyncOptions = {},
) {
  const { enabled = true, accelerated = false } = options;

  const pollBaseMs = accelerated ? DRAFT_POLL_INTERVAL_FAST_MS : DRAFT_POLL_INTERVAL_SLOW_MS;

  const jitterRef = useRef(0);
  useEffect(() => {
    const span = accelerated ? 180 : 520;
    jitterRef.current = Math.floor(span * Math.random());
  }, [accelerated]);

  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const refresh = useCallback(async () => {
    const snapshot = await fetchSnapshot(slug);
    if (snapshot) onUpdateRef.current(snapshot);
  }, [slug]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh, slug]);

  useEffect(() => {
    if (!enabled || !tournamentId) return undefined;

    let supabase;
    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      return undefined;
    }

    const channel = supabase
      .channel(`draft-live:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Tournament",
          filter: `id=eq.${tournamentId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh, tournamentId]);

  useEffect(() => {
    if (!enabled) return undefined;
    const pollMs = pollBaseMs + jitterRef.current;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [enabled, pollBaseMs, refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, refresh]);

  return { refresh };
}
