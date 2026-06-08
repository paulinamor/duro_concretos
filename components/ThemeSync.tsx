"use client";

import { useEffect } from "react";

export type AppTheme = "dark" | "light";

export const THEME_KEY = "duro-theme";

export function applyTheme(theme: AppTheme) {
  if (theme === "light") {
    document.documentElement.classList.remove("dark");
    document.body.classList.add("duro-theme-light");
    document.documentElement.dataset.theme = "light";
  } else {
    document.documentElement.classList.add("dark");
    document.body.classList.remove("duro-theme-light");
    document.documentElement.dataset.theme = "dark";
  }
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(THEME_KEY) as AppTheme) ?? "dark";
}

export function setStoredTheme(theme: AppTheme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("duro:theme-change", { detail: { theme } }));
}

export default function ThemeSync() {
  useEffect(() => {
    applyTheme(getStoredTheme());

    function handleThemeChange(event: Event) {
      const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme as AppTheme | undefined;
      if (theme === "light" || theme === "dark") {
        applyTheme(theme);
      }
    }

    window.addEventListener("duro:theme-change", handleThemeChange);
    return () => window.removeEventListener("duro:theme-change", handleThemeChange);
  }, []);

  return null;
}
