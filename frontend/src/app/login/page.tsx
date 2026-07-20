"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, AlertCircle, Eye, EyeOff, ArrowRight } from "lucide-react";
import { applyTheme } from "@/utils/theme";

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
  const API_URL = "";

  useEffect(() => {
    // Limpiar tema de empresa al cargar login
    localStorage.removeItem("companyTheme");
    applyTheme(null);

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
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
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
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
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
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-clinical-danger-bg border border-clinical-danger-border text-xs text-clinical-danger-text font-medium flex items-center gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 shrink-0 text-clinical-danger-text" />
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
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>


      </div>
    </div>
  );
}

