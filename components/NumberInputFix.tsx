"use client";
import { useEffect } from "react";

export default function NumberInputFix() {
  useEffect(() => {
    const handler = () => {
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "number") {
        document.activeElement.blur();
      }
    };
    document.addEventListener("wheel", handler, { passive: true });
    return () => document.removeEventListener("wheel", handler);
  }, []);
  return null;
}
