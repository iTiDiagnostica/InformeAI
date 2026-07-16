"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Obtener API_URL dinámico compatible con red local
  const API_URL = "/api";

  useEffect(() => {
    // Limpiar tema de empresa al cargar login
    localStorage.removeItem("companyTheme");

    // Si ya está logueado, redirigir según el rol
    const role = localStorage.getItem("role");
    const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
    if (token && role) {
      if (role === "admin") {
        router.push("/templates");
      } else if (role === "moderator") {
        router.push("/companies");
      } else {
        router.push("/");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUsernameEmpty = !username.trim();
    const isPasswordEmpty = !password.trim();

    setUsernameError(isUsernameEmpty);
    setPasswordError(isPasswordEmpty);

    if (isUsernameEmpty || isPasswordEmpty) {
      setError("Por favor complete todos los campos requeridos.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Credenciales incorrectas.");
      }

      const data = await res.json();
      
      // Guardar datos en localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      
      if (data.role === "admin") {
        localStorage.setItem("admin_token", data.token);
        localStorage.removeItem("companyTheme");
        router.push("/templates");
      } else if (data.role === "moderator") {
        localStorage.setItem("admin_token", data.token);
        if (data.companyTheme) {
          localStorage.setItem("companyTheme", JSON.stringify(data.companyTheme));
        } else {
          localStorage.removeItem("companyTheme");
        }
        router.push("/companies");
      } else {
        localStorage.setItem("activeDoctorId", data.doctorId.toString());
        localStorage.setItem("doctor_id", data.doctorId.toString());
        localStorage.setItem("doctor_name", data.doctorName);
        if (data.companyTheme) {
          localStorage.setItem("companyTheme", JSON.stringify(data.companyTheme));
        } else {
          localStorage.removeItem("companyTheme");
        }
        
        // Crear sesión limpia inicial
        const session = {
          rawText: "",
          structuredReport: "",
          currentReportId: null,
          mode: "dictate",
          detectedDoctorId: data.doctorId,
          detectedDoctorName: data.doctorName,
          activeDoctorId: data.doctorId,
          correctionInstruction: "",
        };
        localStorage.setItem("clinica_session", JSON.stringify(session));
        
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-clinical-bg flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Círculos decorativos de fondo con gradientes clínicos */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-clinical-teal/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[35vw] h-[35vw] rounded-full bg-clinical-teal-dim/15 blur-[100px] pointer-events-none"></div>

      {/* Card contenedor con glassmorphism */}
      <div className="w-full max-w-md bg-clinical-panel/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in transition-all">
        {/* Encabezado */}
        <div className="flex flex-col items-center justify-center mb-8">
          <h2 className="text-sm font-bold tracking-wider uppercase text-clinical-text">
            Inicio de Sesión
          </h2>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1.5 block">
              Nombre de Usuario <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                👤
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError && e.target.value.trim()) {
                    setUsernameError(false);
                  }
                }}
                placeholder="Ingrese su usuario"
                className={`w-full bg-slate-950/50 border rounded-xl pl-10 pr-4 py-3 text-xs text-clinical-text focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold ${
                  usernameError
                    ? "border-rose-500 hover:border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                    : "border-slate-800 hover:border-slate-700 focus:border-clinical-teal"
                }`}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1.5 block">
              Contraseña <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                🔒
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError && e.target.value.trim()) {
                    setPasswordError(false);
                  }
                }}
                placeholder="Ingrese su contraseña"
                className={`w-full bg-slate-950/50 border rounded-xl pl-10 pr-12 py-3 text-xs text-clinical-text focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold ${
                  passwordError
                    ? "border-rose-500 hover:border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                    : "border-slate-800 hover:border-slate-700 focus:border-clinical-teal"
                }`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-clinical-teal transition-colors p-1 cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/35 border border-rose-900/50 text-xs text-rose-300 font-medium flex items-center gap-2 animate-pulse">
              <span>⚠️</span>
              <span className="flex-1 leading-snug">{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold text-xs tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
            >
              {isLoading ? (
                <span className="w-5 h-5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
              ) : (
                <>
                  <span>Ingresar al Panel</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>


      </div>
    </div>
  );
}

