"use client";

import { useEffect } from "react";

const CONFIG_KEY = "duro_concretos_configuracion";

function getStoredTheme() {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return "Oscuro";

  try {
    const config = JSON.parse(raw) as { preferences?: { tema?: string } };
    return config.preferences?.tema ?? "Oscuro";
  } catch {
    return "Oscuro";
  }
}

function applyTheme(theme: string) {
  const isLight = theme.toLowerCase() === "claro";
  document.body.classList.toggle("duro-theme-light", isLight);
  document.documentElement.dataset.theme = isLight ? "light" : "dark";
}

export default function ThemeSync() {
  useEffect(() => {
    applyTheme(getStoredTheme());

    function handleThemeChange(event: Event) {
      const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme ?? getStoredTheme();
      applyTheme(theme);
    }

    window.addEventListener("duro:theme-change", handleThemeChange);

    return () => window.removeEventListener("duro:theme-change", handleThemeChange);
  }, []);

  return null;
}
