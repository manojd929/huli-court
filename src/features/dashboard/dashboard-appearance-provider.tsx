"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  DASHBOARD_THEME_STORAGE_KEY,
  parseDashboardFloorTheme,
  type DashboardFloorTheme,
} from "@/constants/dashboard-theme";

type DashboardAppearanceContextValue = {
  hydrated: boolean;
  floorTheme: DashboardFloorTheme;
  setFloorTheme: (theme: DashboardFloorTheme) => void;
};

const DashboardAppearanceContext = createContext<DashboardAppearanceContextValue | null>(null);

export function DashboardAppearanceProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [floorTheme, setFloorThemeState] = useState<DashboardFloorTheme>("broadcast");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = parseDashboardFloorTheme(
          window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY),
        );
        setFloorThemeState(stored);
      } catch {
        setFloorThemeState("broadcast");
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setFloorTheme = useCallback((next: DashboardFloorTheme) => {
    setFloorThemeState(next);
    try {
      window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const value = useMemo(
    () => ({ hydrated, floorTheme, setFloorTheme }),
    [hydrated, floorTheme, setFloorTheme],
  );

  return (
    <DashboardAppearanceContext.Provider value={value}>
      {children}
    </DashboardAppearanceContext.Provider>
  );
}

export function useDashboardAppearance(): DashboardAppearanceContextValue {
  const ctx = useContext(DashboardAppearanceContext);
  if (!ctx) {
    throw new Error("useDashboardAppearance must be used within DashboardAppearanceProvider");
  }
  return ctx;
}
