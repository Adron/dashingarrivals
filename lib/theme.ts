"use client";

// Light / Dark / System theme control.
//
// The chosen *mode* is one of "light" | "dark" | "system" and is persisted to
// localStorage. The *resolved* theme is always "light" | "dark" — for "system"
// it tracks the OS `prefers-color-scheme` and updates live when the OS flips.
//
// Applying a theme = toggling a `.dark` class on <html> (which drives every
// Tailwind `dark:` utility and our CSS vars) plus setting `color-scheme`.
// A pre-paint script in app/layout.tsx applies the same class before React
// hydrates so there is no flash of the wrong theme.

import { useEffect } from "react";
import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyResolved(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
}

function readStoredMode(): ThemeMode {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "light" || s === "dark" || s === "system") return s;
  } catch {
    // localStorage may be unavailable (private mode / SSR); fall through.
  }
  return "system";
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  /** Choose a mode; persists it and applies the resolved theme immediately. */
  setMode: (mode: ThemeMode) => void;
  /** Hydrate from localStorage and start watching the OS setting. Returns cleanup. */
  init: () => () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  // Deterministic defaults for SSR; init() reconciles with localStorage/OS.
  mode: "system",
  resolved: "light",

  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Non-fatal: the choice just won't persist across reloads.
    }
    const resolved = resolveMode(mode);
    applyResolved(resolved);
    set({ mode, resolved });
  },

  init: () => {
    const mode = readStoredMode();
    const resolved = resolveMode(mode);
    applyResolved(resolved);
    set({ mode, resolved });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (get().mode !== "system") return; // only "system" follows the OS
      const next: ResolvedTheme = systemPrefersDark() ? "dark" : "light";
      applyResolved(next);
      set({ resolved: next });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  },
}));

/** Mount-once hook that hydrates the theme and watches the OS setting. */
export function useThemeInit(): void {
  useEffect(() => useTheme.getState().init(), []);
}
