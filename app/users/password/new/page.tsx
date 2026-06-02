"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isRegisteredEmail, recordAuthEvent } from "@/lib/auth";

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function showToast(type: "success" | "error", title: string, message: string) {
    window.dispatchEvent(
      new CustomEvent("duro:toast", {
        detail: { type, title, message },
      }),
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSent(false);

    if (!email.trim()) {
      const message = "Ingresa el correo para recuperar la contraseña.";
      setError(message);
      recordAuthEvent({ type: "password_recovery", email: "sin correo", message });
      showToast("error", "No se pudo enviar", message);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const message = "El correo electrónico no tiene un formato válido.";
      setError(message);
      recordAuthEvent({ type: "password_recovery", email, message });
      showToast("error", "No se pudo enviar", message);
      return;
    }

    if (!isRegisteredEmail(email)) {
      const message = "Ese correo no está registrado en el ERP.";
      setError(message);
      recordAuthEvent({ type: "password_recovery", email, message });
      showToast("error", "No se pudo enviar", message);
      return;
    }

    setSent(true);
    recordAuthEvent({ type: "password_recovery", email, message: "Solicitud de recuperación generada correctamente." });
    showToast("success", "Recuperación enviada", "Se generó la solicitud para restablecer la contraseña.");
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #CC2229 0, #CC2229 1px, transparent 0, transparent 50%)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="bg-[#242424] rounded-2xl shadow-2xl border border-[#3A3A3A] overflow-hidden">
          <div className="bg-white flex flex-col items-center justify-center py-10 px-8">
            <div className="relative w-56 h-24">
              <Image
                src="/LOGO_DC.png"
                alt="Duro Concretos"
                fill
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
          </div>
          <div className="h-1 bg-[#CC2229]" />
          <div className="px-8 py-8">
            <h1 className="text-2xl font-bold text-white mb-1">Recuperar contraseña</h1>
            <p className="text-gray-400 text-sm mb-8">
              Ingresa tu correo registrado para generar una solicitud de recuperación.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@duroconcretos.mx"
                  className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#CC2229] focus:border-transparent transition"
                />
              </div>
              {error && <p className="text-[#CC2229] text-sm">{error}</p>}
              {sent && <p className="text-green-400 text-sm">Solicitud generada correctamente.</p>}
              <button
                type="submit"
                className="w-full bg-[#CC2229] hover:bg-[#991A1E] text-white font-semibold py-3 rounded-lg transition-colors duration-200"
              >
                Enviar recuperación
              </button>
            </form>
            <div className="mt-5 text-center">
              <Link href="/" className="text-sm text-gray-400 hover:text-[#CC2229] transition-colors">
                Volver al login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
