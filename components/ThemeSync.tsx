"use client";

import { useEffect } from "react";

function applyTheme() {
  document.body.classList.remove("duro-theme-light");
  document.documentElement.classList.add("dark");
  document.documentElement.dataset.theme = "dark";
}

export default function ThemeSync() {
  useEffect(() => {
    applyTheme();

    function handleThemeChange(event: Event) {
      void (event as CustomEvent<{ theme?: string }>).detail?.theme;
      applyTheme();
    }

    window.addEventListener("duro:theme-change", handleThemeChange);

    return () => window.removeEventListener("duro:theme-change", handleThemeChange);
  }, []);

  return null;
}
