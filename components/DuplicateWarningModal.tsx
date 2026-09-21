"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  field: string;      // e.g. "Nombre del operador"
  value: string;      // the value that matched
  detail?: string;    // extra info about the existing record
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DuplicateWarningModal({ field, value, detail, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
        onClick={onCancel}
      />
      <div className="relative bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 mb-4">
          <AlertTriangle size={20} className="text-amber-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Posible duplicado</h3>
        <p className="text-xs text-slate-500 mb-1">
          Ya existe un registro con el mismo <span className="font-medium text-slate-700">{field}</span>:
        </p>
        <div className="my-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5">
          <p className="text-xs font-semibold text-amber-800 break-words">{value}</p>
          {detail && <p className="text-[11px] text-amber-600 mt-0.5 break-words">{detail}</p>}
        </div>
        <p className="text-xs text-slate-400 mb-5">
          ¿Deseas crear el registro de todas formas?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors cursor-pointer"
          >
            Crear de todas formas
          </button>
        </div>
      </div>
    </div>
  );
}
