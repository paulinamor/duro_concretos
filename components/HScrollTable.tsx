"use client";

import { useEffect, useRef } from "react";

export default function HScrollTable({
  children,
  className = "",
  maxHeight,
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Drag-to-scroll
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const container = el;
    let down = false, startX = 0, startLeft = 0, moved = false;

    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("button,input,select,textarea,a,[role=button]")) return;
      if (e.button !== 0) return;
      down = true; moved = false;
      startX = e.clientX; startLeft = container.scrollLeft;
    }
    function onMove(e: MouseEvent) {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) {
        moved = true;
        container.scrollLeft = startLeft - dx;
        container.style.cursor = "grabbing";
        container.style.userSelect = "none";
      }
    }
    function onUp() {
      if (!down) return;
      down = false;
      container.style.cursor = "";
      container.style.userSelect = "";
    }
    function onClick(e: MouseEvent) {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }

    container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    container.addEventListener("click", onClick, true);
    return () => {
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      container.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`overflow-x-auto overflow-y-auto ${className}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}
