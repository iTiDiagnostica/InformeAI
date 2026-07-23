'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface ReportFeedbackControlsProps {
  reportId?: number | null;
  initialRating?: number | null;
  onFeedbackGiven?: (rating: number) => void;
}

export function ReportFeedbackControls({ reportId, initialRating = null, onFeedbackGiven }: ReportFeedbackControlsProps) {
  const [rating, setRating] = useState<number | null>(initialRating || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRating(initialRating || null);
  }, [reportId, initialRating]);

  if (!reportId) return null;

  const handleRate = async (newRating: number, isExemplar: boolean = false) => {
    setLoading(true);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('admin_token') : null;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/reports/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reportId,
          rating: newRating,
          isExemplar
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar feedback.');
      }

      setRating(newRating === 0 ? null : newRating);
      if (onFeedbackGiven) onFeedbackGiven(newRating);
    } catch (err: any) {
      console.error('Error al calificar informe:', err);
    } finally {
      setLoading(false);
    }
  };

  // Estado Compacto post-calificación con botón de Deshacer
  if (rating === 1 || rating === -1) {
    return (
      <div className="inline-flex items-center gap-2 py-1 px-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs animate-in fade-in duration-200">
        {rating === 1 ? (
          <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <span>⭐</span>
            <span>Ejemplo Modélico Guardado</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
            <span>👎</span>
            <span>Marcado como Inadecuado</span>
          </span>
        )}

        <span className="text-slate-400 dark:text-slate-600">|</span>
        <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">¡Gracias por tu calificación!</span>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleRate(0, false)}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-all text-[11px] cursor-pointer"
          title="Deshacer calificación y volver a elegir"
        >
          <RotateCcw className="w-3 h-3 text-slate-500" />
          <span>Deshacer</span>
        </button>
      </div>
    );
  }

  // Estado Inicial para calificar
  return (
    <div className="flex flex-wrap items-center gap-2.5 py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
      <span className="font-medium text-slate-600 dark:text-slate-300">
        ¿Qué tal el informe generado?
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => handleRate(1, true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-all cursor-pointer"
          title="Calificar positivamente y guardar como plantilla/ejemplo modélico para tus próximos informes"
        >
          <span>👍</span>
          <span>Excelente (Guardar Ejemplo)</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleRate(-1, false)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800 transition-all cursor-pointer"
          title="Calificar negativamente este resultado"
        >
          <span>👎</span>
          <span>Inadecuado</span>
        </button>
      </div>
    </div>
  );
}
