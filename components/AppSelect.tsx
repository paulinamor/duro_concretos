"use client";

import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

type AppSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Dark variant for page-level filters on dark backgrounds */
  dark?: boolean;
  /** Compact variant — smaller padding, xs text */
  compact?: boolean;
  /** Outer wrapper className (controls width, margin, etc.) */
  wrapperClassName?: string;
};

/**
 * Styled select that replaces native <select>.
 * Hides the native arrow and renders a custom ChevronDown.
 * Pass `dark` for filters on dark backgrounds.
 * Pass `compact` for small inline filters.
 * The `className` prop applies to the wrapper div.
 */
export default function AppSelect({
  dark = false,
  compact = false,
  className,
  wrapperClassName,
  children,
  disabled,
  ...props
}: AppSelectProps) {
  const wrapper = wrapperClassName ?? className ?? "w-full";

  const selectCls = [
    "w-full appearance-none cursor-pointer pr-8 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
    compact
      ? dark
        ? "bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:ring-1 focus:ring-[#CC2229]/60 focus:border-[#CC2229]/60"
        : "bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 focus:ring-1 focus:ring-[#CC2229]/20 focus:border-[#CC2229]/60"
      : dark
      ? "bg-[#242424] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-1 focus:ring-[#CC2229]/60 focus:border-[#CC2229]/60"
      : "bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:ring-1 focus:ring-[#CC2229]/20 focus:border-[#CC2229]/60",
  ].join(" ");

  const chevronColor = dark ? "text-gray-500" : "text-gray-400";

  return (
    <div className={`relative ${wrapper}`}>
      <select {...props} disabled={disabled} className={selectCls}>
        {children}
      </select>
      <ChevronDown
        size={compact ? 12 : 14}
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${chevronColor}`}
      />
    </div>
  );
}
