"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

interface ClienteComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function ClienteCombobox({
  value,
  onChange,
  options,
  placeholder = "Buscar o escribir…",
  label,
  required,
}: ClienteComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync inputVal when value changes externally
  useEffect(() => { setInputVal(value); }, [value]);

  const filtered = inputVal.trim() && inputVal !== value
    ? options.filter((o) => o.toLowerCase().includes(inputVal.toLowerCase()))
    : options;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // On blur: if no exact match, revert to saved value
        setInputVal(value);
        setOpen(false);
        setCursor(-1);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [value]);

  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const item = listRef.current.children[cursor] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor]);

  function select(opt: string) {
    onChange(opt);
    setInputVal(opt);
    setOpen(false);
    setCursor(-1);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setInputVal("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (cursor >= 0 && filtered[cursor]) {
        select(filtered[cursor]);
      } else if (inputVal.trim()) {
        select(inputVal.trim());
      }
    } else if (e.key === "Escape") {
      setInputVal(value);
      setOpen(false);
      setCursor(-1);
    }
  }

  const focused = open;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
          {label} {required && <span className="text-[#CC2229]">*</span>}
        </label>
      )}

      {/* The input IS the search field */}
      <div
        className={`flex items-center bg-white border rounded-xl px-3.5 transition-all duration-150 ${
          focused
            ? "border-[#CC2229]/60 ring-1 ring-[#CC2229]/20"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <input
          ref={inputRef}
          value={inputVal}
          placeholder={placeholder}
          onChange={(e) => {
            setInputVal(e.target.value);
            setCursor(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{ outline: "none", boxShadow: "none" }}
          className="flex-1 bg-transparent py-2.5 text-sm text-gray-900 placeholder-gray-400 border-0 ring-0 focus:ring-0 focus:outline-none min-w-0"
        />
        <div className="flex items-center gap-0.5 pl-1 shrink-0">
          {inputVal && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={clear}
              className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
          <ChevronDown
            size={13}
            className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          className="absolute z-[200] mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)" }}
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-4 text-center">
              <p className="text-sm text-gray-400 mb-1.5">Sin resultados</p>
              {inputVal.trim() && (
                <button
                  type="button"
                  onMouseDown={() => select(inputVal.trim())}
                  className="text-xs font-semibold text-[#CC2229] hover:underline"
                >
                  + Usar "{inputVal.trim()}"
                </button>
              )}
            </li>
          ) : (
            filtered.map((opt, i) => {
              const isActive = i === cursor;
              const isSelected = opt === value;
              return (
                <li key={opt}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={() => select(opt)}
                    onMouseEnter={() => setCursor(i)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm text-left transition-colors cursor-pointer ${
                      isActive ? "bg-gray-50" : ""
                    }`}
                  >
                    <span className={isSelected ? "font-semibold text-gray-900" : "text-gray-700"}>
                      {opt}
                    </span>
                    {isSelected && <Check size={12} className="text-[#CC2229] shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
          {/* New entry footer */}
          {inputVal.trim() && filtered.length > 0 && !filtered.some((o) => o.toLowerCase() === inputVal.toLowerCase()) && (
            <li className="border-t border-gray-100 px-3.5 py-2">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={() => select(inputVal.trim())}
                className="text-xs font-semibold text-[#CC2229] hover:underline cursor-pointer"
              >
                + Usar "{inputVal.trim()}" como nuevo cliente
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
