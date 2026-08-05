"use client";

import { useEffect, useState } from "react";
import { Mail, ShieldCheck, UserCircle } from "lucide-react";
import { getStoredSession } from "@/lib/auth";

export default function PerfilPage() {
  const [session, setSession] = useState(() => getStoredSession());

  useEffect(() => {
    function onUpdate() { setSession(getStoredSession()); }
    window.addEventListener("duro:session-updated", onUpdate);
    return () => window.removeEventListener("duro:session-updated", onUpdate);
  }, []);

  const nombre = session?.name ?? "—";
  const email  = session?.email ?? "—";
  const rol    = session?.role === "admin" ? "Administrador" : "Operador";
  const initials = nombre.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <p className="text-gray-500 text-sm">Información del usuario activo</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-6">
          <div className="w-16 h-16 bg-[#CC2229] rounded-full flex items-center justify-center mb-4">
            {initials ? (
              <span className="text-white font-bold text-xl">{initials}</span>
            ) : (
              <UserCircle size={34} className="text-white" />
            )}
          </div>
          <h2 className="text-white font-bold text-lg">{nombre}</h2>
          <p className="text-gray-500 text-sm">Duro Concretos</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-700 bg-green-900/30 px-3 py-1 text-xs text-green-400">
            <ShieldCheck size={13} />
            {rol} activo
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Datos de cuenta</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input value={nombre} readOnly className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Empresa</label>
              <input value="Duro Concretos" readOnly className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Correo</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={email} readOnly className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Rol</label>
              <input value={rol} readOnly className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
