"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { findUserByCredentials, recordAuthEvent, saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function showErrorToast(message: string) {
    window.dispatchEvent(
      new CustomEvent("duro:toast", {
        detail: {
          type: "error",
          title: "No se pudo iniciar sesión",
          message,
        },
      })
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      const message = "Por favor ingresa tus credenciales.";
      setError(message);
      recordAuthEvent({ type: "login_failed", email: email || "sin correo", message });
      showErrorToast(message);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const message = "El correo electrónico no tiene un formato válido.";
      setError(message);
      recordAuthEvent({ type: "login_failed", email, message });
      showErrorToast(message);
      return;
    }
    const user = findUserByCredentials(email, password);
    if (!user) {
      const message = "Correo o contraseña incorrectos. Verifica tus datos.";
      setError(message);
      recordAuthEvent({ type: "login_failed", email, message });
      showErrorToast(message);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      saveSession(user);
      recordAuthEvent({ type: "login_success", email: user.email, message: `Acceso autorizado como ${user.role}.` });
      router.push("/dashboard");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center px-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #CC2229 0, #CC2229 1px, transparent 0, transparent 50%)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-[#242424] rounded-2xl shadow-2xl border border-[#3A3A3A] overflow-hidden">
          {/* Logo area */}
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

          {/* Red divider */}
          <div className="h-1 bg-[#CC2229]" />

          {/* Form area */}
          <div className="px-8 py-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              Bienvenido
            </h1>
            <p className="text-gray-400 text-sm mb-8">
              Ingresa tus credenciales para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@duroconcretos.mx"
                  className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#CC2229] focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#CC2229] focus:border-transparent transition"
                />
              </div>

              {error && (
                <p className="text-[#CC2229] text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#CC2229] hover:bg-[#991A1E] disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </button>
            </form>
            <div className="mt-5 text-center">
              <Link href="/users/password/new" className="text-sm text-gray-400 hover:text-[#CC2229] transition-colors">
                Recuperar contraseña
              </Link>
            </div>

          </div>
        </div>

        <div className="flex flex-col items-center gap-1 mt-6">
          <p className="text-gray-700 text-xs">© 2026 Duro Concretos. Todos los derechos reservados.</p>
          <a href="https://lpsoft.mx" target="_blank" rel="noopener noreferrer" className="text-gray-600 text-xs hover:text-[#CC2229] transition-colors">By Software and Solutions LP</a>
        </div>
      </div>
    </div>
  );
}
