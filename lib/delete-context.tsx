"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

export interface ConfirmDeleteOpts {
  title: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
}

interface DeleteContextValue {
  confirmDelete: (opts: ConfirmDeleteOpts) => void;
}

export const DeleteContext = createContext<DeleteContextValue | null>(null);

export function useConfirmDelete() {
  const ctx = useContext(DeleteContext);
  if (!ctx) throw new Error("useConfirmDelete must be used inside DeleteProvider");
  return ctx.confirmDelete;
}

export function DeleteProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmDeleteOpts | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmDelete = useCallback((o: ConfirmDeleteOpts) => setOpts(o), []);

  async function handleConfirm() {
    if (!opts) return;
    setLoading(true);
    try { await opts.onConfirm(); } finally {
      setLoading(false);
      setOpts(null);
    }
  }

  return (
    <DeleteContext.Provider value={{ confirmDelete }}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-red-900/30 border-b border-red-800/40 px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{opts.title}</p>
                <p className="text-red-400 text-xs mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            {opts.description && (
              <div className="px-6 py-3 border-b border-[#3A3A3A]">
                <p className="text-gray-300 text-sm">{opts.description}</p>
              </div>
            )}
            <div className="px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setOpts(null)}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#333] text-gray-200 hover:bg-[#404040] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {loading && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </DeleteContext.Provider>
  );
}
