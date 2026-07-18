"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("❌ Error capturado por Error Boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-clinical-bg flex items-center justify-center p-6">
      <div className="bg-clinical-panel border border-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-full bg-rose-950/40 border border-rose-800 flex items-center justify-center text-rose-400 mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-clinical-text mb-2">
          Algo salió mal
        </h2>
        <p className="text-xs text-clinical-text-muted mb-6 leading-relaxed">
          Ocurrió un error inesperado. Puede intentar recargar la página o volver a la pantalla principal.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-clinical-teal text-slate-950 text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.href = "/login"}
            className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-clinical-text text-xs font-bold hover:bg-slate-700 transition-all cursor-pointer"
          >
            Ir al Login
          </button>
        </div>
        {error?.message && (
          <details className="mt-4 text-left">
            <summary className="text-[10px] text-clinical-text-muted cursor-pointer hover:text-clinical-text transition-colors">
              Detalles técnicos
            </summary>
            <pre className="mt-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] text-rose-400 overflow-auto max-h-32 whitespace-pre-wrap break-all">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
