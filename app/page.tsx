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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f1115] px-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #CC2229 0, #CC2229 1px, transparent 0, transparent 50%)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(204,34,41,0.18),transparent_55%)]" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#181b20] shadow-2xl shadow-black/45">
          {/* Logo area */}
          <div className="flex flex-col items-center justify-center bg-white px-8 py-10">
            <div className="relative h-24 w-56">
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
            <h1 className="mb-1 text-2xl font-bold text-white">
              Bienvenido
            </h1>
            <p className="mb-8 text-sm text-gray-400">
              Ingresa tus credenciales para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@duroconcretos.mx"
                  className="w-full rounded-lg border border-white/10 bg-[#111318] px-4 py-3 text-white placeholder-gray-600 transition focus:border-[#CC2229]/60 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/10 bg-[#111318] px-4 py-3 text-white placeholder-gray-600 transition focus:border-[#CC2229]/60 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#CC2229] py-3 font-semibold text-white shadow-lg shadow-[#CC2229]/15 transition-colors duration-200 hover:bg-[#b51f25] disabled:opacity-60"
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
              <Link href="/users/password/new" className="text-sm text-gray-400 transition-colors hover:text-[#CC2229]">
                Recuperar contraseña
              </Link>
            </div>

          </div>
        </div>

        <div className="flex flex-col items-center gap-1 mt-6">
          <p className="text-xs text-gray-700">© 2026 Duro Concretos. Todos los derechos reservados.</p>
          <a href="https://lpsoft.mx" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 transition-colors hover:text-[#CC2229]">By Software and Solutions LP</a>
        </div>
      </div>
    </div>
  );
}
