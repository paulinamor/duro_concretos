"use client";

import { X } from "lucide-react";

interface FormModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export default function FormModal({
  title,
  open,
  onClose,
  children,
  footer,
}: FormModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar formulario"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#3A3A3A] bg-[#242424] px-6 py-4">
          <h3 className="text-white font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#3A3A3A] bg-[#242424] px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  );
}
