"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { APP_THEME_STORAGE_KEY } from "@/constants/theme-storage";

export type AppTheme = "dark" | "light" | "system";

type AppThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function readStoredTheme(enableSystem: boolean, fallback: AppTheme): AppTheme {
  try {
    const raw = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") {
      return raw;
    }
    if (raw === "system" && enableSystem) {
      return "system";
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function resolveAppliedTheme(theme: AppTheme): "dark" | "light" {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/** Light mode = no `dark` class (shadcn-style). Clears legacy `light` class from older builds. */
function applyThemeClass(applied: "dark" | "light"): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (applied === "dark") {
    root.classList.add("dark");
  }
}

function applyResolvedTheme(themeMode: AppTheme, disableTransition: boolean): void {
  const applied = resolveAppliedTheme(themeMode);
  if (disableTransition) {
    const root = document.documentElement;
    const previous = root.style.transition;
    root.style.transition = "none";
    applyThemeClass(applied);
    requestAnimationFrame(() => {
      root.style.transition = previous;
    });
    return;
  }
  applyThemeClass(applied);
}

interface AppThemeProviderProps {
  children: ReactNode;
  /** Matches prior next-themes default. */
  defaultTheme?: AppTheme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function AppThemeProvider({
  children,
  defaultTheme = "dark",
  enableSystem = true,
  disableTransitionOnChange = false,
}: AppThemeProviderProps) {
  const [theme, setThemeState] = useState<AppTheme>(defaultTheme);
  const [hasReadStoredPreference, setHasReadStoredPreference] = useState(false);

  /** Single mount path: read storage once so we never apply stale defaultTheme over real preference. */
  useEffect(() => {
    const stored = readStoredTheme(enableSystem, defaultTheme);
    startTransition(() => {
      setThemeState(stored);
      setHasReadStoredPreference(true);
    });
  }, [defaultTheme, enableSystem]);

  /** Runs only after localStorage has been merged into React state (avoids mount race with stale theme). */
  useEffect(() => {
    if (!hasReadStoredPreference) return;
    applyResolvedTheme(theme, disableTransitionOnChange);
    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [disableTransitionOnChange, hasReadStoredPreference, theme]);

  useEffect(() => {
    if (!hasReadStoredPreference) return undefined;
    if (!enableSystem || theme !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyResolvedTheme("system", disableTransitionOnChange);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [disableTransitionOnChange, enableSystem, hasReadStoredPreference, theme]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}

function subscribePreferredDark(onStoreChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getPreferredDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** SSR default until client resolves stored preference or system. */
function getPreferredDarkServerSnapshot(): boolean {
  return true;
}

/** Resolved light/dark for UI that cannot use `system` during SSR (e.g. Sonner). */
export function useResolvedTheme(): "dark" | "light" {
  const { theme } = useAppTheme();
  const prefersDark = useSyncExternalStore(
    subscribePreferredDark,
    getPreferredDarkSnapshot,
    getPreferredDarkServerSnapshot,
  );

  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }
  return theme;
}
