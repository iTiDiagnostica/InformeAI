import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmBtnClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  confirmBtnClassName = "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/10",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-clinical-panel border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-rose-950/40 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-clinical-text tracking-wide mb-1.5">
              {title}
            </h3>
            <p className="text-xs text-clinical-text-muted leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-clinical-text hover:text-clinical-text transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${confirmBtnClassName}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
