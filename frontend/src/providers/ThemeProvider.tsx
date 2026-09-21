"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Theme } from "@/schemas";
import { readTheme, resolveTheme, THEME_KEY } from "./theme";

type ThemeValue = { theme: Theme; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeValue | null>(null);

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset["theme"] = resolveTheme(theme);
    };
    apply();
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Blocked storage: the choice applies after the next change event only.
    }
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
