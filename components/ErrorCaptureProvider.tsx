"use client";

import { useEffect } from "react";
import { logError } from "@/lib/errorLogger";

export default function ErrorCaptureProvider() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      const msg = e.message ?? "Unknown runtime error";
      if (msg.includes("ResizeObserver") || msg.includes("Script error")) return;
      logError({
        message: msg,
        stack: e.error?.stack,
        type: "runtime",
        context: {
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
        },
      });
    }

    function onUnhandledRejection(e: PromiseRejectionEvent) {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Unhandled promise rejection");
      const stack = e.reason instanceof Error ? e.reason.stack : undefined;
      logError({ message: msg, stack, type: "unhandled_promise" });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
