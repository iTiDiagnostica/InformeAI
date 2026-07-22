"use client";

import React from "react";
import {
  X, Check, ExternalLink, Search, Users,
  AlertTriangle, Stethoscope, Cpu
} from "lucide-react";
import { Doctor } from "@/types";
import { getInitials } from "@/utils/reportHtml";
import { GeminiLogo, ChatGPTLogo } from "./AiProviderLogos";

// ==========================================
// Props
// ==========================================
interface DictadorModalsProps {
  // Template Error Modal
  isTemplateErrorModalOpen: boolean;
  setIsTemplateErrorModalOpen: (v: boolean) => void;
  missingTemplateName: string;
  onNavigateTemplates: () => void;

  // AI Warning Modal
  isAiWarningModalOpen: boolean;
  setIsAiWarningModalOpen: (v: boolean) => void;
  aiWarningModalMessage: string;

  // Doctor Selection Modal
  isDoctorModalOpen: boolean;
  setIsDoctorModalOpen: (v: boolean) => void;
  activeDoctorId: number | null;
  doctors: Doctor[];
  doctorSearchTerm: string;
  setDoctorSearchTerm: (v: string) => void;
  onSelectDoctor: (doc: Doctor) => void;

  // Mic Warning Modal
  showMicWarning: boolean;
  setShowMicWarning: (v: boolean) => void;
  micWarningDetails: { title: string; message: string; instructions: string[] };

  // AI Provider Modal
  isAiModalOpen: boolean;
  setIsAiModalOpen: (v: boolean) => void;
  activeAiModel: string;
  selectAiProvider: (providerId: string) => void;

  // AI Error Modal
  aiErrorDetails: { isOpen: boolean; providerName: string; message: string; technicalDetail?: string };
  setAiErrorDetails: React.Dispatch<React.SetStateAction<{ isOpen: boolean; providerName: string; message: string; technicalDetail?: string }>>;
  getAiProviderInfo: (model: string) => { name: string; logo: React.ReactNode };

  // Copy Toast
  copySuccess: boolean;
}

export function DictadorModals({
  isTemplateErrorModalOpen, setIsTemplateErrorModalOpen, missingTemplateName, onNavigateTemplates,
  isAiWarningModalOpen, setIsAiWarningModalOpen, aiWarningModalMessage,
  isDoctorModalOpen, setIsDoctorModalOpen, activeDoctorId, doctors, doctorSearchTerm, setDoctorSearchTerm, onSelectDoctor,
  showMicWarning, setShowMicWarning, micWarningDetails,
  isAiModalOpen, setIsAiModalOpen, activeAiModel, selectAiProvider,
  aiErrorDetails, setAiErrorDetails, getAiProviderInfo,
  copySuccess,
}: DictadorModalsProps) {
  return (
    <>
      {/* Modal de Error de Plantilla No Encontrada */}
      {isTemplateErrorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-clinical-panel border border-clinical-border rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-clinical-border mb-4 shrink-0">
              <h3 className="font-bold text-base text-clinical-text tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-clinical-danger-text shrink-0" /> Plantilla No Encontrada
              </h3>
              <button
                onClick={() => setIsTemplateErrorModalOpen(false)}
                className="p-1 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="space-y-3 mb-6 flex-1 text-xs leading-relaxed text-clinical-text">
              <p>
                El perfil del médico actual no cuenta con la plantilla cargada o la IA no pudo encontrarla en sus registros.
              </p>
              {missingTemplateName && (
                <div className="p-3 bg-clinical-surface-inset/50 border border-clinical-border rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted block mb-1">
                    Búsqueda solicitada:
                  </span>
                  <span className="font-semibold text-clinical-danger-text">
                    &quot;{missingTemplateName}&quot;
                  </span>
                </div>
              )}
              <p className="text-clinical-text-muted">
                Por favor, verifique las plantillas disponibles en su panel o cargue una nueva si es necesario.
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => setIsTemplateErrorModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text font-bold tracking-wide transition-all border border-clinical-border cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setIsTemplateErrorModalOpen(false);
                  onNavigateTemplates();
                }}
                className="flex-1 py-2 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <span>Verificar</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Advertencia de la IA (Dictado no médico / inválido) */}
      {isAiWarningModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="modal-rounded-container bg-clinical-panel border border-clinical-border max-w-md w-full p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-clinical-border mb-4 shrink-0">
              <h3 className="font-bold text-base text-clinical-text tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-clinical-warning-text shrink-0" /> Atención
              </h3>
              <button
                onClick={() => setIsAiWarningModalOpen(false)}
                className="p-1.5 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="space-y-3 mb-6 flex-1 text-xs leading-relaxed">
              <div className="p-4 bg-clinical-warning-bg border border-clinical-warning-border text-clinical-warning-text rounded-xl font-semibold leading-relaxed">
                {aiWarningModalMessage}
              </div>
            </div>

            {/* Botón Aceptar */}
            <div className="flex justify-end shrink-0">
              <button
                onClick={() => setIsAiWarningModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Selección Obligatoria de Médico */}
      {isDoctorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
             onKeyDown={(e) => {
               if (e.key === "Escape" && !activeDoctorId) {
                 e.preventDefault();
               }
             }}
        >
          <div className="bg-clinical-panel border border-clinical-border rounded-2xl max-w-2xl w-full p-8 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-clinical-border mb-6 shrink-0">
              <div>
                <h3 className="font-bold text-lg text-clinical-text tracking-wide flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-clinical-teal" /> Seleccionar Perfil de Médico
                </h3>
                <p className="text-xs text-clinical-text-muted mt-1 leading-relaxed">
                  Para dictar, cargar audio o escribir informes, primero debe seleccionar su perfil profesional. Esto asegura cargar las plantillas correctas.
                </p>
              </div>
              {activeDoctorId && (
                <button
                  onClick={() => setIsDoctorModalOpen(false)}
                  className="p-1.5 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Buscador de Médicos */}
            <div className="relative mb-6 shrink-0">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={doctorSearchTerm}
                onChange={(e) => setDoctorSearchTerm(e.target.value)}
                placeholder="Buscar médico por nombre o especialidad..."
                className="w-full bg-clinical-surface-inset/60 border border-clinical-border rounded-xl pl-10 pr-8 py-3 text-xs focus:outline-none focus:border-clinical-teal text-clinical-text font-medium transition-all"
              />
              {doctorSearchTerm && (
                <button
                  onClick={() => setDoctorSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-clinical-text transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Listado de Médicos */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
              {(() => {
                const filtered = doctors.filter(doc => 
                  doc.name.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                  doc.specialty.toLowerCase().includes(doctorSearchTerm.toLowerCase())
                );
                
                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center text-center p-8 text-clinical-text-muted">
                      <div className="w-12 h-12 rounded-full bg-clinical-surface border border-clinical-border flex items-center justify-center mb-3 text-clinical-text-muted">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-xs text-clinical-text">No se encontraron médicos</h4>
                      <p className="text-[11px] mt-1">Intente buscar con otro nombre o especialidad.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                    {filtered.map((doc) => {
                      const isSelected = activeDoctorId === doc.id;
                      return (
                        <div
                          key={doc.id}
                          onClick={() => onSelectDoctor(doc)}
                          className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-all duration-200 group relative ${
                            isSelected
                              ? "bg-clinical-teal/10 border-clinical-teal/40 text-clinical-text"
                              : "bg-clinical-surface-inset/40 border-clinical-border hover:border-clinical-border hover:bg-clinical-surface/80 text-clinical-text-muted hover:text-clinical-text"
                          }`}
                        >
                          {/* Avatar con Iniciales */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border transition-all ${
                            isSelected
                              ? "bg-clinical-teal/20 text-clinical-teal border-clinical-teal/30"
                              : "bg-clinical-surface text-clinical-text-muted border-clinical-border group-hover:bg-clinical-teal/10 group-hover:text-clinical-teal group-hover:border-clinical-teal/20"
                          }`}>
                            {getInitials(doc.name)}
                          </div>
                          
                          {/* Datos */}
                          <div className="min-w-0 flex-1">
                            <h4 className={`text-xs font-bold truncate transition-colors ${
                              isSelected ? "text-clinical-teal" : "text-clinical-text group-hover:text-clinical-teal"
                            }`}>
                              {doc.name}
                            </h4>
                            <p className="text-[10px] text-clinical-text-muted mt-0.5 truncate uppercase tracking-wider font-semibold">
                              {doc.specialty}
                            </p>
                          </div>
                          
                          {/* Indicador de Seleccionado */}
                          {isSelected && (
                            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-clinical-teal"></span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer del Modal */}
            <div className="mt-6 pt-4 border-t border-clinical-border shrink-0 flex justify-end gap-3">
              {activeDoctorId && (
                <button
                  onClick={() => setIsDoctorModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-clinical-surface/80 hover:bg-clinical-surface border border-clinical-border text-xs font-semibold text-clinical-text transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Advertencia de Micrófono */}
      {showMicWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-clinical-panel border border-clinical-border rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="font-bold text-base text-clinical-text tracking-wide">{micWarningDetails.title}</h3>
                <p className="text-xs text-clinical-text-muted leading-relaxed">{micWarningDetails.message}</p>
                
                {micWarningDetails.instructions.length > 0 && (
                  <div className="bg-clinical-surface-inset/50 rounded-xl p-4 border border-clinical-border/80 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-clinical-teal">Instrucciones Paso a Paso:</p>
                    <ul className="space-y-1.5">
                      {micWarningDetails.instructions.map((inst, index) => (
                        <li key={index} className="text-xs text-clinical-text leading-relaxed font-medium">
                          {inst}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowMicWarning(false)}
                className="px-5 py-2.5 rounded-xl bg-clinical-surface/80 hover:bg-clinical-surface border border-clinical-border text-xs font-semibold text-clinical-text hover:text-clinical-text transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Selección de Proveedor de IA */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-clinical-panel border border-clinical-border rounded-3xl p-6 shadow-2xl max-w-lg w-full flex flex-col space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-clinical-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-clinical-teal/10 border border-clinical-teal/30 flex items-center justify-center text-clinical-teal shrink-0">
                  <Cpu className="w-5 h-5 text-clinical-teal" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-clinical-text uppercase tracking-wider">
                    Proveedor de IA
                  </h3>
                  <p className="text-[11px] text-clinical-text-muted mt-0.5">
                    Seleccione la tecnología de Inteligencia Artificial para estructurar sus dictados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1.5 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text border border-clinical-border/50 transition-all cursor-pointer"
                title="Cerrar"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opciones de Tarjetas */}
            <div className="grid grid-cols-1 gap-3">
              {/* Opción 1: Gemini */}
              <button
                type="button"
                onClick={() => selectAiProvider("gemini")}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between relative group cursor-pointer ${
                  activeAiModel.toLowerCase().includes("gemini")
                    ? "bg-clinical-teal/10 border-clinical-teal shadow-md shadow-clinical-teal/5 ring-1 ring-clinical-teal/30"
                    : "bg-clinical-surface-inset border-clinical-border hover:border-clinical-teal/40 hover:bg-clinical-surface/70"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-clinical-surface border border-clinical-border/80 shadow-sm shrink-0 flex items-center justify-center">
                    <GeminiLogo className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-clinical-text tracking-wide">Gemini</h4>
                    <p className="text-xs text-clinical-text-muted mt-0.5 leading-relaxed truncate">
                      Alta velocidad y precisión médica
                    </p>
                  </div>
                </div>
                {activeAiModel.toLowerCase().includes("gemini") && (
                  <span className="w-6 h-6 rounded-full bg-clinical-teal text-slate-950 flex items-center justify-center shrink-0 ml-3 shadow-sm font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </span>
                )}
              </button>

              {/* Opción 2: ChatGPT */}
              <button
                type="button"
                onClick={() => selectAiProvider("chatgpt")}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between relative group cursor-pointer ${
                  activeAiModel.toLowerCase().includes("chatgpt") || activeAiModel.toLowerCase().includes("openai")
                    ? "bg-clinical-teal/10 border-clinical-teal shadow-md shadow-clinical-teal/5 ring-1 ring-clinical-teal/30"
                    : "bg-clinical-surface-inset border-clinical-border hover:border-clinical-teal/40 hover:bg-clinical-surface/70"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-clinical-surface border border-clinical-border/80 shadow-sm shrink-0 flex items-center justify-center">
                    <ChatGPTLogo className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-clinical-text tracking-wide">ChatGPT</h4>
                    <p className="text-xs text-clinical-text-muted mt-0.5 leading-relaxed truncate">
                      Razonamiento y síntesis avanzada
                    </p>
                  </div>
                </div>
                {(activeAiModel.toLowerCase().includes("chatgpt") || activeAiModel.toLowerCase().includes("openai")) && (
                  <span className="w-6 h-6 rounded-full bg-clinical-teal text-slate-950 flex items-center justify-center shrink-0 ml-3 shadow-sm font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </span>
                )}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Error de Proveedor de IA */}
      {aiErrorDetails.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-clinical-panel border border-clinical-border rounded-3xl p-6 shadow-2xl max-w-md w-full flex flex-col space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header del Modal con Logo del Proveedor */}
            <div className="flex items-center justify-between pb-3 border-b border-clinical-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-clinical-surface border border-clinical-border/80 shadow-sm shrink-0 flex items-center justify-center">
                  {getAiProviderInfo(aiErrorDetails.providerName).logo}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-clinical-text uppercase tracking-wider">
                    Servicio No Disponible
                  </h3>
                  <p className="text-[11px] font-semibold text-clinical-text-muted mt-0.5">
                    Motor IA: <span className="text-clinical-teal font-bold">{aiErrorDetails.providerName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiErrorDetails((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text border border-clinical-border/50 transition-all cursor-pointer"
                title="Cerrar"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mensaje Breve y Directo */}
            <div className="p-4 rounded-2xl bg-clinical-surface-inset border border-clinical-border">
              <p className="text-xs text-clinical-text leading-relaxed font-medium">
                El servicio de Inteligencia Artificial <strong className="text-clinical-teal">{aiErrorDetails.providerName}</strong> no se encuentra disponible momentáneamente. Por favor seleccione otro motor de Inteligencia Artificial.
              </p>
            </div>

            {/* Acciones */}
            <div className="pt-1 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAiErrorDetails((prev) => ({ ...prev, isOpen: false }))}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiErrorDetails((prev) => ({ ...prev, isOpen: false }));
                  setIsAiModalOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal/90 text-slate-950 text-xs font-bold transition-all shadow-md shadow-clinical-teal/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Cpu className="w-4 h-4 text-slate-950" />
                Seleccionar otro Motor IA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast flotante de copiado exitoso */}
      {copySuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-clinical-success-bg border border-clinical-success-border text-clinical-success-text px-4 py-2.5 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <Check className="w-4 h-4 text-clinical-success-text" />
          <span className="text-xs font-semibold">¡Informe copiado al portapapeles con éxito!</span>
        </div>
      )}
    </>
  );
}
