
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Mic, Upload, Trash2, Sparkles, Wand2, Undo2, Redo2, Maximize2, Minimize2, 
  Copy, Check, Bold, Italic, Underline, ChevronDown, LayoutTemplate, 
  Info, X, Stethoscope, Square, Plus,
  Bot, Pause, Play
} from "lucide-react";

import { Company, Doctor, Report, SpeechRecognitionInstance, SpeechRecognitionEvent } from "@/types";
import { sanitizeHtml } from "@/utils/sanitize";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { applyTheme } from "@/utils/theme";
import {
  convertHtmlToMarkdown, convertReportToHtml, convertReportToClipboardHtml,
  isAiWarningMessage, cleanHtmlForComparison,
  AUDIO_WAVE_HEIGHTS, getInitials
} from "@/utils/reportHtml";
import { GeminiLogo, ChatGPTLogo } from "@/components/dictador/AiProviderLogos";
import { DictadorModals } from "@/components/dictador/DictadorModals";

export default function DictationPage() {
  const router = useRouter();
  // Resolver API_URL de forma dinámica en red local para evitar fallas al conectar desde otros dispositivos
  const API_URL = "";
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const [mode, setMode] = useState<"dictate" | "correct">("dictate");
  const [rawText, setRawText] = useState("");
  const [correctionInstruction, setCorrectionInstruction] = useState("");
  const [structuredReport, setStructuredReport] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  // Estados para Deshacer/Rehacer (Undo/Redo) en el Informe
  const [reportHistory, setReportHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const historyIndexRef = useRef(-1);
  const reportHistoryRef = useRef<string[]>([]);
  const saveHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateSourceRef = useRef<"direct" | "typing" | "history_nav">("direct");

  // Sincronizar Refs
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    reportHistoryRef.current = reportHistory;
  }, [reportHistory]);

  // Limpiar temporizador al desmontar
  useEffect(() => {
    return () => {
      if (saveHistoryTimeoutRef.current) {
        clearTimeout(saveHistoryTimeoutRef.current);
      }
    };
  }, []);

  const pushToHistoryStack = useCallback((val: string) => {
    const currentHistory = reportHistoryRef.current;
    const currentIndex = historyIndexRef.current;
    
    // Cortar cualquier historial de "rehacer" si hicimos un cambio nuevo en el medio de la pila
    const activeHistory = currentHistory.slice(0, currentIndex + 1);
    
    // Evitar duplicar la entrada actual
    if (activeHistory.length > 0 && activeHistory[activeHistory.length - 1] === val) {
      return;
    }
    
    const newHistory = [...activeHistory, val];
    setReportHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, []);
  const updateReportState = useCallback((newVal: string, updateMode: "direct" | "typing" | "history_nav" = "direct") => {
    updateSourceRef.current = updateMode;
    setStructuredReport(newVal);
    if (newVal.trim() !== "") {
      setIsEditorOpen(true);
    }

    if (updateMode === "history_nav") {
      return;
    }

    if (saveHistoryTimeoutRef.current) {
      clearTimeout(saveHistoryTimeoutRef.current);
      saveHistoryTimeoutRef.current = null;
    }

    if (updateMode === "typing") {
      // Debounce para la escritura manual (1 segundo)
      saveHistoryTimeoutRef.current = setTimeout(() => {
        pushToHistoryStack(newVal);
      }, 1000);
    } else {
      // Cambio directo (por ejemplo, IA o carga inicial) -> agregar de inmediato
      pushToHistoryStack(newVal);
    }
  }, [pushToHistoryStack]);

  const handleUndo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = reportHistoryRef.current;
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setHistoryIndex(prevIndex);
      const prevReport = currentHistory[prevIndex];
      updateReportState(prevReport, "history_nav");
    }
  }, [updateReportState]);

  const handleRedo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = reportHistoryRef.current;
    if (currentIndex < currentHistory.length - 1) {
      const nextIndex = currentIndex + 1;
      setHistoryIndex(nextIndex);
      const nextReport = currentHistory[nextIndex];
      updateReportState(nextReport, "history_nav");
    }
  }, [updateReportState]);

  // Atajos de teclado para Ctrl+Z y Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleUndo, handleRedo]);
  const [currentReportId, setCurrentReportId] = useState<number | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");

  // Estados de carga e interfaz
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [history, setHistory] = useState<Report[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Estados de Médicos
  const [detectedDoctorId, setDetectedDoctorId] = useState<number | null>(null);
  const [detectedDoctorName, setDetectedDoctorName] = useState<string | null>(null);
  const [detectedDoctorSpecialty, setDetectedDoctorSpecialty] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeDoctorId, setActiveDoctorId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeAiModel, setActiveAiModel] = useState<string>("gemini");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiErrorDetails, setAiErrorDetails] = useState<{
    isOpen: boolean;
    providerName: string;
    message: string;
    technicalDetail?: string;
  }>({
    isOpen: false,
    providerName: "Gemini",
    message: "",
    technicalDetail: "",
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>("base");
  const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("11 pt");
  const savedRangeRef = useRef<Range | null>(null);

  const getAiProviderInfo = (model: string) => {
    const lower = (model || "").toLowerCase();
    if (lower.includes("chatgpt") || lower.includes("openai") || lower.includes("gpt")) {
      return { id: "chatgpt", name: "ChatGPT", logo: <ChatGPTLogo className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> };
    }
    return { id: "gemini", name: "Gemini", logo: <GeminiLogo className="w-4 h-4" /> };
  };

  const triggerAiErrorModal = (data: any, defaultErrorMsg: string) => {
    const rawError = data?.error || defaultErrorMsg;
    const providerName = data?.aiProvider || getAiProviderInfo(activeAiModel).name;
    setAiErrorDetails({
      isOpen: true,
      providerName,
      message: `El servicio de Inteligencia Artificial (${providerName}) no se encuentra disponible por el momento. Por favor seleccione otro modelo de Inteligencia Artificial o contacte al administrador.`,
      technicalDetail: rawError
    });
  };

  const selectAiProvider = async (providerId: string) => {
    setActiveAiModel(providerId);
    setIsAiModalOpen(false);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("admin_token") : null;
      await fetch(`${API_URL}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ activeAiModel: providerId })
      });
    } catch (err) {
      console.error("Error al guardar el proveedor de IA:", err);
    }
  };

  const fetchCompanies = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/companies`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
    }
  }, [API_URL]);



  const handlePreviewCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedPreviewCompanyId(val);
    
    if (val === "base") {
      localStorage.removeItem("companyTheme");
      applyTheme(null);
      setCompanyLogo(null);
      setCompanyName(null);
    } else {
      const comp = companies.find(c => c.id.toString() === val);
      if (comp) {
        const theme = {
          id: comp.id,
          name: comp.name,
          logo: comp.logoBase64,
          favicon: comp.faviconBase64,
          primary: comp.colorPrimary,
          secondary: comp.colorSecondary,
          accent: comp.colorAccent
        };
        localStorage.setItem("companyTheme", JSON.stringify(theme));
        applyTheme(theme);
        setCompanyLogo(comp.logoBase64 || null);
        setCompanyName(comp.name);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const companyThemeStr = localStorage.getItem("companyTheme");
      if (companyThemeStr) {
        try {
          const theme = JSON.parse(companyThemeStr);
          if (theme) {
            setCompanyLogo(theme.logo || null);
            setCompanyName(theme.name || null);
            setSelectedPreviewCompanyId(theme.id?.toString() || "base");
            applyTheme(theme);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setCompanyLogo(null);
        setCompanyName(null);
        setSelectedPreviewCompanyId("base");
        applyTheme(null);
      }
    }
  }, [isInitialized]);
  
  // Estados para modal de login/selección obligatoria de médico
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [isTemplateErrorModalOpen, setIsTemplateErrorModalOpen] = useState(false);
  const [missingTemplateName, setMissingTemplateName] = useState("");
  const [doctorSearchTerm, setDoctorSearchTerm] = useState("");
  const [isAiWarningModalOpen, setIsAiWarningModalOpen] = useState(false);
  const [aiWarningModalMessage, setAiWarningModalMessage] = useState("");

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else if (!isRecording) {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("doctor_id");
    localStorage.removeItem("doctor_name");
    localStorage.removeItem("activeDoctorId");
    localStorage.removeItem("clinica_session");
    localStorage.removeItem("companyTheme");
    setIsAdmin(false);
    router.push("/login");
  };


  // Estados para advertencia de micrófono e IP local insegura (Milestone 5)
  const [showMicWarning, setShowMicWarning] = useState(false);
  const [micWarningDetails, setMicWarningDetails] = useState({
    title: "",
    message: "",
    instructions: [] as string[]
  });

  // Referencias para SpeechRecognition
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);



  const fetchHistory = useCallback(async () => {
    try {
      const headers: HeadersInit = {};
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_URL}/api/reports`, { headers });
      if (res.ok) {
        const data = await res.json();
        // Mapear snake_case del backend a camelCase del frontend
        interface DbReportRow {
          id: number;
          raw_text?: string;
          rawText?: string;
          structured_text?: string;
          structuredText?: string;
          created_at?: string;
          createdAt?: string;
          doctorId?: number | null;
          doctorName?: string | null;
          doctorSpecialty?: string | null;
        }
        const reportsArray = Array.isArray(data) ? data : (data.reports || []);
        const mapped: Report[] = reportsArray.map((row: DbReportRow & { reportType?: string, createdByRole?: string, aiType?: string }) => ({
          id: row.id,
          rawText: row.raw_text || row.rawText || '',
          structuredText: row.structured_text || row.structuredText || '',
          createdAt: row.created_at || row.createdAt,
          doctorId: row.doctorId,
          doctorName: row.doctorName,
          doctorSpecialty: row.doctorSpecialty,
          reportType: row.reportType,
          createdByRole: row.createdByRole,
          aiType: row.aiType,
        }));
        setHistory(mapped);
      }
    } catch (err) {
      console.error("Error al cargar historial:", err);
    }
  }, [API_URL]);

  const fetchDoctors = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/doctors`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (err) {
      console.error("Error al cargar médicos:", err);
    }
  }, [API_URL]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        // La API devuelve snake_case (active_ai_model), no camelCase
        const model = data.active_ai_model || data.activeAiModel || "gemini";
        setActiveAiModel(model);
      }
    } catch (err) {
      console.error("Error al cargar configuración de IA:", err);
    }
  }, [API_URL]);

  const handleAiModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setActiveAiModel(newModel);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("admin_token") : null;
      await fetch(`${API_URL}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ activeAiModel: newModel })
      });
    } catch (err) {
      console.error("Error al guardar el modelo de IA:", err);
    }
  };

  


  // Restaurar sesión desde localStorage al montar
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Redirección si no está autenticado
    const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
    const role = localStorage.getItem("role");
    
    if (!token) {
      router.push("/login");
      return;
    }

    if (role === "moderator") {
      router.push("/templates");
      return;
    }

    setIsAuthenticated(true);
    if (role === "admin") {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }

    try {
      const saved = localStorage.getItem("clinica_session");
      let hasActiveDoc = false;
      
      let sessionData: any = null;
      if (saved) {
        try {
          sessionData = JSON.parse(saved);
        } catch (err) {
          console.error("Error al parsear clinica_session:", err);
        }
      }

      if (sessionData && sessionData.action === "load") {
        // Cargar explícitamente el informe del historial
        updateReportState(convertReportToHtml(sessionData.structuredReport || ""), "direct");
        setRawText(sessionData.rawText || "");
        setCurrentReportId(sessionData.currentReportId || null);
        setCorrectionInstruction("");
        setMode(sessionData.mode || "correct");
        setDetectedDoctorId(sessionData.detectedDoctorId || null);
        setDetectedDoctorName(sessionData.detectedDoctorName || "");
        setDetectedDoctorSpecialty(sessionData.detectedDoctorSpecialty || "");
        
        if (sessionData.activeDoctorId !== undefined && sessionData.activeDoctorId !== null) {
          setActiveDoctorId(sessionData.activeDoctorId);
          hasActiveDoc = true;
        }
      } else {
        // Siempre forzar la limpieza de los datos del informe al recargar la página (por defecto)
        updateReportState("", "direct");
        setRawText("");
        setCurrentReportId(null);
        setCorrectionInstruction("");
        setMode("dictate");
        setDetectedDoctorId(null);
        setDetectedDoctorName("");
        setDetectedDoctorSpecialty("");

        if (role === "doctor") {
          const docId = localStorage.getItem("doctor_id");
          if (docId) {
            const parsedDocId = parseInt(docId);
            setActiveDoctorId(parsedDocId);
            setDetectedDoctorId(parsedDocId);
            setDetectedDoctorName(localStorage.getItem("doctor_name") || "");
            hasActiveDoc = true;
          }
        } else if (sessionData) {
          // Si no es médico, únicamente restaurar el médico activo seleccionado en el dropdown
          if (sessionData.activeDoctorId !== undefined && sessionData.activeDoctorId !== null) {
            setActiveDoctorId(sessionData.activeDoctorId);
            hasActiveDoc = true;
          }
        }
      }

      // Eliminar la sesión guardada para evitar inconsistencias
      localStorage.removeItem("clinica_session");

      if (!hasActiveDoc && role !== "doctor") {
        setIsDoctorModalOpen(true);
      }
    } catch (err) {
      console.error("Error durante la inicialización de la sesión:", err);
      if (role !== "doctor") {
        setIsDoctorModalOpen(true);
      }
    }

    setIsInitialized(true);

    fetchHistory();
    fetchDoctors();
    fetchSettings();
    if (role === "admin") {
      fetchCompanies();
    }

    // Verificar soporte para Web Speech API
    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setIsSpeechSupported(false);
    }
  }, [fetchHistory, router]);

  // Limpiar el temporizador de silencio al desmontar el componente
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Guardar sesión en localStorage cuando cambian los datos clave (con debounce para evitar lag al escribir)
  useEffect(() => {
    if (typeof window === "undefined" || !isInitialized) return;
    
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("clinica_session", JSON.stringify({
          rawText,
          structuredReport,
          currentReportId,
          mode,
          detectedDoctorId,
          detectedDoctorName,
          detectedDoctorSpecialty,
          activeDoctorId,
          correctionInstruction,
        }));
      } catch { /* ignorar errores de localStorage */ }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [rawText, structuredReport, currentReportId, mode, detectedDoctorId, detectedDoctorName, detectedDoctorSpecialty, activeDoctorId, correctionInstruction, isInitialized]);

  // Sincronizar structuredReport (HTML) hacia el editor contentEditable
  useEffect(() => {
    if (editorRef.current) {
      // Si el último cambio vino de la escritura del usuario, NO sobreescribir el editor
      if (updateSourceRef.current === "typing") {
        updateSourceRef.current = "direct";
        return;
      }

      // structuredReport ya es HTML — inyectarlo directamente
      if (editorRef.current.innerHTML !== structuredReport) {
        editorRef.current.innerHTML = sanitizeHtml(structuredReport);
      }
    }
  }, [structuredReport]);

  // Capturar cambios manuales del médico y sincronizar el HTML directamente
  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      updateReportState(html, "typing");
    }
  };

  // Cerrar selector de fuente al hacer click fuera
  useEffect(() => {
    if (!isFontSizeOpen) return;
    const handleOutsideClick = () => {
      setIsFontSizeOpen(false);
    };
    // Usar timeout para evitar que el mismo evento click que abre el dropdown lo cierre inmediatamente
    const timeoutId = setTimeout(() => {
      window.addEventListener("click", handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [isFontSizeOpen]);

  const handleFontSizeChange = (size: string) => {
    if (typeof window === 'undefined' || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;

    // Actualizar siempre el dropdown con el tamaño seleccionado
    const displaySize = size.replace('pt', ' pt');
    setCurrentFontSize(displaySize);

    // Intentar usar la selección activa; si está colapsada, restaurar la selección guardada
    let range: Range | null = null;
    if (selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
      range = selection.getRangeAt(0);
    } else if (savedRangeRef.current && !savedRangeRef.current.collapsed) {
      range = savedRangeRef.current;
      // Restaurar la selección en el navegador
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Si no hay rango seleccionado, solo actualizar el dropdown (el próximo texto usará este tamaño)
    if (!range || range.collapsed) return;

    // Verificar que la selección esté dentro de los límites del editor
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    try {
      const wrapper = document.createElement('span');
      wrapper.style.fontSize = size;
      wrapper.style.fontFamily = 'Arial, Helvetica, sans-serif';
      wrapper.style.lineHeight = '1.4';

      const fragment = range.extractContents();

      // Limpiar estilos de font-size anteriores dentro del fragmento para evitar anidamientos conflictivos
      const nestedFontSizeElements = fragment.querySelectorAll('span[style*="font-size"], font');
      nestedFontSizeElements.forEach((el: any) => {
        el.style.fontSize = '';
        el.removeAttribute('size');
        if (el.style.length === 0 && el.tagName.toLowerCase() === 'span') {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        }
      });

      wrapper.appendChild(fragment);
      range.insertNode(wrapper);

      // Re-seleccionar el texto estilizado para mantener la selección
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(wrapper);
      selection.addRange(newRange);

      // Limpiar la selección guardada
      savedRangeRef.current = null;

      // Sincronizar el estado del editor
      handleEditorInput();
    } catch (e) {
      console.error('Error al aplicar tamaño de fuente:', e);
    }
  };

  // Detectar y actualizar el tamaño de fuente de la selección actual
  const isFontSizeOpenRef = useRef(isFontSizeOpen);
  useEffect(() => {
    isFontSizeOpenRef.current = isFontSizeOpen;
  }, [isFontSizeOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !isEditorOpen) return;

    const handleSelectionChange = () => {
      // No actualizar el dropdown mientras está abierto — evita que se resetee al hacer clic en una opción
      if (isFontSizeOpenRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editorRef.current) return;

      try {
        const range = selection.getRangeAt(0);
        if (!editorRef.current.contains(range.commonAncestorContainer)) {
          return;
        }

        let node = range.commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode!;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          let current: HTMLElement | null = node as HTMLElement;
          let foundSize = "11 pt";
          while (current && current !== editorRef.current) {
            if (current.style && current.style.fontSize) {
              foundSize = current.style.fontSize.replace('pt', ' pt');
              break;
            }
            current = current.parentElement;
          }
          setCurrentFontSize(foundSize);
        }
      } catch (e) {
        // ignorar errores de selección
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [isEditorOpen]);

  // fetchHistory y fetchDoctors han sido declarados arriba como useCallback.

  // Disparador de advertencia amigable del micrófono e IP insegura (Milestone 5)
  const triggerMicWarning = (errorType: 'insecure' | 'blocked' | 'notFound' | 'other', customMsg?: string) => {
    let title = "Acceso al Micrófono Bloqueado";
    let message = "";
    let instructions: string[] = [];

    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://192.168.2.41:3000";

    if (errorType === 'insecure') {
      title = "⚠️ Conexión Insegura (HTTP) y Micrófono Bloqueado";
      message = `El navegador bloquea el uso del micrófono en sitios HTTP no seguros cuando se accede a través de una dirección IP (${currentOrigin}). Para habilitarlo, debes configurar una excepción en tu navegador Chrome.`;
      instructions = [
        `1. Abre una nueva pestaña en Google Chrome y escribe/pega en la barra de direcciones: chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
        `2. Busca la sección "Insecure origins treated as secure".`,
        `3. Cambia el estado a "Enabled" e ingresa la dirección IP de la aplicación: ${currentOrigin}`,
        `4. Haz clic en el botón "Relaunch" abajo a la derecha para reiniciar Chrome y aplicar los cambios.`,
        `5. Vuelve a ingresar a esta página y concede el permiso de micrófono.`
      ];
    } else if (errorType === 'blocked') {
      title = "Permiso de Micrófono Denegado";
      message = "El acceso al micrófono ha sido bloqueado para este sitio. Debes permitirlo manualmente en la barra de direcciones.";
      instructions = [
        "1. Haz clic en el ícono del candado (o indicador de sitio) a la izquierda de la URL en la barra de direcciones.",
        "2. Asegúrate de que el control de 'Micrófono' esté activado / permitido.",
        "3. Recarga la página y vuelve a intentar."
      ];
    } else if (errorType === 'notFound') {
      title = "Micrófono no Detectado";
      message = "No pudimos encontrar ningún dispositivo de entrada de audio conectado a tu equipo.";
      instructions = [
        "1. Conecta un micrófono externo o verifica que el integrado esté encendido.",
        "2. Abre la configuración de sonido de tu sistema para confirmar la entrada de audio.",
        "3. Recarga la página."
      ];
    } else {
      title = "Error del Micrófono";
      message = customMsg || "Ocurrió un error inesperado al intentar acceder al micrófono.";
      instructions = [
        "1. Desconecta y vuelve a conectar tu dispositivo de audio.",
        "2. Cierra otras aplicaciones que puedan estar utilizando el micrófono.",
        "3. Recarga la página."
      ];
    }

    setMicWarningDetails({ title, message, instructions });
    setShowMicWarning(true);
  };

  // Concatenar dictados sucesivos separándolos con un espacio
  const formatAppendedText = (prevText: string, newText: string): string => {
    const existing = (prevText || "").trim();
    const addition = (newText || "").trim();
    if (!existing) return addition;
    if (!addition) return existing;

    return `${existing} ${addition}`;
  };

  // Lógica de grabación por voz (Speech Recognition)
  const startRecording = async () => {
    if (isRecording && isPaused) {
      resumeRecording();
      return;
    }
    setError(null);
    setIsPaused(false);
    isPausedRef.current = false;
    await startRecordingInternal();
  };

  const pauseRecording = () => {
    if (!isRecordingRef.current || isPausedRef.current) return;
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    isPausedRef.current = true;
    setIsPaused(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Error al pausar reconocimiento de voz:", err);
      }
    }
  };

  const resumeRecording = () => {
    if (!isRecordingRef.current || !isPausedRef.current) return;
    isPausedRef.current = false;
    setIsPaused(false);
    startRecordingInternal();
  };

  const startRecordingInternal = async () => {
    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setError("La API de voz no está soportada en este navegador. Use Google Chrome.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerMicWarning('notFound');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (micErr) {
      const err = micErr as { name: string; message: string };
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        triggerMicWarning('blocked');
      } else if (err.name === "NotFoundError") {
        triggerMicWarning('notFound');
      } else {
        triggerMicWarning('other', err.message);
      }
      return;
    }

    try {
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "es-AR"; // Español Argentina / Latinoamérica

      rec.onstart = () => {
        setIsRecording(true);
        isRecordingRef.current = true;
        setInterimTranscript("");
        resetSilenceTimeout(5000); // 5 segundos de espera inicial antes de comenzar a hablar
      };

      rec.onresult = (event: SpeechRecognitionEvent) => {
        resetSilenceTimeout(2000); // 2 segundos de tolerancia tras detectar voz
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimTranscript(interim);

        if (final) {
          if (mode === "dictate") {
            setRawText((prev) => formatAppendedText(prev, final));
          } else {
            setCorrectionInstruction((prev) => formatAppendedText(prev, final));
          }
        }
      };

      rec.onerror = (event: { error: string }) => {
        console.error("Speech recognition error", event.error);
        if (event.error === "not-allowed") {
          triggerMicWarning('blocked');
          stopRecording();
        } else if (event.error !== "no-speech") {
          setError(`Error de dictado: ${event.error}`);
          stopRecording();
        }
      };

      rec.onend = () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        if (isPausedRef.current) {
          return;
        }
        if (isRecordingRef.current) {
          try {
            rec.start();
          } catch (err) {
            console.error("Failed to restart speech recognition:", err);
            setIsRecording(false);
            isRecordingRef.current = false;
            setIsPaused(false);
            isPausedRef.current = false;
            setInterimTranscript("");
          }
        } else {
          setIsRecording(false);
          setIsPaused(false);
          isPausedRef.current = false;
          setInterimTranscript("");
        }
      };

      recognitionRef.current = rec;
      isRecordingRef.current = true;
      rec.start();
    } catch (err) {
      const errorObj = err as Error;
      setError(`No se pudo iniciar el micrófono: ${errorObj.message}`);
    }
  };

  const stopRecording = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  const resetSilenceTimeout = (ms: number = 2000) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    if (isPausedRef.current) return;
    silenceTimeoutRef.current = setTimeout(() => {
      stopRecording();
    }, ms);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Cargar archivo de audio y transcribir via Whisper
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setAudioFileName(file.name);
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const res = await fetch(`${API_URL}/api/audio/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al transcribir el audio.");
      }

      const data = await res.json();
      const transcription = data.transcription || data.text || "";

      if (!transcription || typeof transcription !== "string" || transcription.trim().length === 0) {
        throw new Error("No se pudo obtener el texto de la transcripción de audio.");
      }

      if (mode === "dictate") {
        setRawText((prev) => formatAppendedText(prev, transcription));
      } else {
        setCorrectionInstruction((prev) => formatAppendedText(prev, transcription));
      }
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "No se pudo transcribir el audio.");
    } finally {
      setIsTranscribing(false);
      setAudioFileName(null);
      // Reset del input para permitir cargar el mismo archivo nuevamente
      if (audioInputRef.current) {
        audioInputRef.current.value = "";
      }
    }
  };

  // Enviar texto para estructuración inicial
  const handleStructureReport = async () => {
    if (!rawText || !rawText.trim()) {
      setError("Por favor escriba o dicte el texto del informe primero.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("admin_token") : null;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/reports/structure`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rawText, doctorId: activeDoctorId }),
      });

      if (!res.ok) {
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `Error del servidor (${res.status}).` };
        }
        if (data.code === 'TEMPLATE_NOT_FOUND') {
          setMissingTemplateName(data.query || rawText);
          setIsTemplateErrorModalOpen(true);
          return;
        }
        triggerAiErrorModal(data, "No se pudo procesar la solicitud con el servicio de Inteligencia Artificial.");
        return;
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        triggerAiErrorModal({}, "La respuesta del servicio de IA no es válida.");
        return;
      }

      const structuredText = data?.structuredText || data?.structuredReport || "";
      if (!structuredText || typeof structuredText !== "string" || structuredText.trim().length === 0) {
        triggerAiErrorModal({}, "La IA no generó un informe válido. Intente nuevamente.");
        return;
      }

      if (isAiWarningMessage(structuredText)) {
        setAiWarningModalMessage(structuredText);
        setIsAiWarningModalOpen(true);
        return;
      }

      // La IA devuelve markdown — convertirlo a HTML una sola vez para almacenarlo
      updateReportState(convertReportToHtml(structuredText), "direct");
      setCurrentReportId(data.id || data.reportId || null);
      setMode("correct"); // Cambiar automáticamente al modo corrección una vez generado
      
      // Guardar médico autodetectado
      setDetectedDoctorId(data.doctorId || null);
      setDetectedDoctorName(data.doctorName || null);
      setDetectedDoctorSpecialty(data.doctorSpecialty || null);


      fetchHistory();
    } catch (err: any) {
      triggerAiErrorModal({ error: err.message }, "Error al conectar con el servidor de Inteligencia Artificial.");
    } finally {
      setIsLoading(false);
    }
  };


  // Enviar corrección incremental
  const handleApplyCorrection = async () => {
    if (!correctionInstruction || !correctionInstruction.trim()) {
      setError("Por favor escriba o dicte la corrección a aplicar.");
      return;
    }
    if (!structuredReport) {
      setError("Primero debe generar un informe estructurado antes de aplicar correcciones.");
      return;
    }

    // Extraer representación del informe actual para el backend de IA (preservando formato)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizeHtml(structuredReport);
    
    // Convertir elementos visuales a sintaxis limpia conservando el contenido interno y formato
    tempDiv.querySelectorAll('strong, b').forEach(el => {
      const content = el.innerHTML;
      el.replaceWith(`**${content}**`);
    });
    tempDiv.querySelectorAll('em, i').forEach(el => {
      const content = el.innerHTML;
      el.replaceWith(`*${content}*`);
    });

    const plainReportForAI = tempDiv.innerHTML || tempDiv.innerText || tempDiv.textContent || '';

    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("admin_token") : null;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/reports/correct`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          reportId: currentReportId,
          originalReport: plainReportForAI,
          correctionInstruction,
          doctorId: activeDoctorId,
        }),
      });

      if (!res.ok) {
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `Error del servidor (${res.status}).` };
        }
        triggerAiErrorModal(data, "No se pudo aplicar la corrección con el servicio de Inteligencia Artificial.");
        return;
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        triggerAiErrorModal({}, "La respuesta de corrección del servicio de IA no es válida.");
        return;
      }

      const correctedText = data?.structuredText || data?.structuredReport || "";
      if (!correctedText || typeof correctedText !== "string" || correctedText.trim().length === 0) {
        triggerAiErrorModal({}, "La IA no generó una corrección válida. Intente nuevamente.");
        return;
      }

      if (isAiWarningMessage(correctedText)) {
        setAiWarningModalMessage(correctedText);
        setIsAiWarningModalOpen(true);
        return;
      }

      // La IA devuelve markdown — convertirlo a HTML una sola vez
      updateReportState(convertReportToHtml(correctedText), "direct");
      // setCorrectionInstruction(""); // Se comenta por pedido del usuario para mantener visible la instrucción y poder comparar
      
      // Guardar médico autodetectado/perdurado
      setDetectedDoctorId(data.doctorId || null);
      setDetectedDoctorName(data.doctorName || null);
      setDetectedDoctorSpecialty(data.doctorSpecialty || null);
      fetchHistory();
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  // Resetear espacio de trabajo para nuevo informe
  const handleNewReport = () => {
    setRawText("");
    setCorrectionInstruction("");
    updateReportState("", "direct");
    setCurrentReportId(null);
    setMode("dictate");
    setError(null);
    setDetectedDoctorId(null);
    setDetectedDoctorName(null);
    setDetectedDoctorSpecialty(null);
    setIsEditorOpen(true);
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  };
  // Limpiar el contenido del informe editable manteniendo el editor abierto y reseteando estado para nuevo informe
  const handleClearEditor = () => {
    updateReportState("", "direct");
    setRawText("");
    setCorrectionInstruction("");
    setCurrentReportId(null);
    setMode("dictate");
    setError(null);
    setDetectedDoctorId(null);
    setDetectedDoctorName(null);
    setDetectedDoctorSpecialty(null);
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    setIsEditorOpen(true);
  };  // convertReportToHtml ha sido movida al ámbito global al inicio del archivo.

  // Copiar informe al portapapeles como HTML limpio para editores RTE + texto plano
  const handleCopyClipboard = async () => {
    if (!structuredReport) return;

    // structuredReport ya es HTML — envolverlo para el portapapeles con la firma de Google Docs
    const clipboardHtml = `<b id="docs-internal-guid-clinical-report" style="font-weight:normal;">\n<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; background-color: #ffffff; padding: 12pt; line-height: 1.15; text-align: left;">\n${structuredReport}\n</div>\n</b>`;

    // Extraer texto plano del HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizeHtml(structuredReport);
    const plainText = "\n" + (tempDiv.innerText || tempDiv.textContent || '').replace(/\t/g, " ");

    /**
     * Copia rica interceptando el evento 'copy'.
     * Esto inyecta directamente el HTML y el texto plano en el portapapeles sin pasar
     * por la serialización del DOM de la página, eliminando el fondo negro del tema oscuro.
     * También mantiene el formato y evita que el texto se colapse en una sola línea.
     */
    const copyViaEvent = (htmlContent: string, plainTextContent: string): boolean => {
      let success = false;
      const listener = (e: any) => {
        if (e.clipboardData) {
          e.clipboardData.setData("text/html", htmlContent);
          e.clipboardData.setData("text/plain", plainTextContent);
          e.preventDefault(); // Detener el copiado por defecto de la selección
          success = true;
        }
      };

      document.addEventListener("copy", listener);

      // Crear un elemento temporal seleccionable para que execCommand('copy') se ejecute.
      const tempElement = document.createElement("span");
      tempElement.textContent = "copiando...";
      tempElement.style.position = "fixed";
      tempElement.style.left = "-9999px";
      tempElement.style.top = "-9999px";
      document.body.appendChild(tempElement);

      const range = document.createRange();
      range.selectNodeContents(tempElement);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      try {
        success = document.execCommand("copy");
      } catch (err) {
        console.error("Error al ejecutar execCommand('copy'):", err);
      } finally {
        if (selection) {
          selection.removeAllRanges();
        }
        document.body.removeChild(tempElement);
        document.removeEventListener("copy", listener);
      }
      return success;
    };

    try {
      // Intentar usar Clipboard API moderna si está disponible (solo contextos seguros HTTPS / localhost)
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([clipboardHtml], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        // Fallback robusto para contextos HTTP inseguros (IP de red local)
        copyViaEvent(clipboardHtml, plainText);
      }
    } catch {
      // Fallback de emergencia si Clipboard API falla
      try {
        copyViaEvent(clipboardHtml, plainText);
      } catch { /* silenciar error final */ }
    }

    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
          <span className="text-xs text-clinical-text-muted font-semibold tracking-wide">Cargando dictador de voz...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-clinical-bg text-clinical-text font-sans">
      
      {/* Sidebar de Navegación Lateral — oculto en móvil, colapsado en tablet, expandido en desktop */}
      {!isMaximized && (
        <AppSidebar
          isAdmin={isAdmin}
          isModerator={typeof window !== "undefined" && localStorage.getItem("role") === "moderator"}
          isDoctor={typeof window !== "undefined" && localStorage.getItem("role") === "doctor"}
          companyName={companyName}
          companyLogo={companyLogo}
          isMaximized={isMaximized}
          onLogout={handleLogout}
          isAuthenticated={typeof window !== "undefined" && !!(localStorage.getItem("token") || localStorage.getItem("admin_token"))}
        />
      )}

      {/* Workspace de Trabajo Principal */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
        {/* Mobile Nav — visible solo en < 768px */}
        <MobileNav
          isAdmin={isAdmin}
          isModerator={typeof window !== "undefined" && localStorage.getItem("role") === "moderator"}
          isDoctor={typeof window !== "undefined" && localStorage.getItem("role") === "doctor"}
          companyName={companyName}
          companyLogo={companyLogo}
          onLogout={handleLogout}
          isAuthenticated={typeof window !== "undefined" && !!(localStorage.getItem("token") || localStorage.getItem("admin_token"))}
        />
        {/* Top Navbar — oculto en móvil */}
        <header className="hidden md:flex h-12 xl:h-14 2xl:h-16 border-b border-clinical-border items-center justify-between px-4 xl:px-6 2xl:px-8 bg-clinical-panel shrink-0">
          <div></div>

          <div className="flex items-center gap-4">
            {/* Selector de Vista Previa de Empresa (Solo Admin) */}
            {isAdmin && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-clinical-text-muted font-semibold">Vista Previa:</span>
                <select
                  value={selectedPreviewCompanyId}
                  onChange={handlePreviewCompanyChange}
                  className="bg-clinical-surface-inset border border-clinical-border rounded-lg px-3 py-1.5 text-xs text-clinical-text font-semibold focus:outline-none focus:border-clinical-teal cursor-pointer"
                >
                  <option value="base">Sistema (Base)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Botón Selector de Proveedor de IA con Modal y Logos */}
            {(() => {
              const info = getAiProviderInfo(activeAiModel);
              return (
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-clinical-surface-inset border border-clinical-border hover:border-clinical-teal/50 hover:bg-clinical-surface transition-all cursor-pointer select-none group"
                  title="Cambiar proveedor de Inteligencia Artificial"
                >
                  <span className="text-xs text-clinical-text-muted font-semibold">Motor IA:</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-clinical-panel border border-clinical-border/60">
                    {info.logo}
                    <span className="text-xs font-bold text-clinical-text group-hover:text-clinical-teal transition-colors">
                      {info.name}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-clinical-text-muted group-hover:text-clinical-teal transition-colors" />
                </button>
              );
            })()}

            
            {/* Botón de Perfil Médico Activo */}
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs text-clinical-text-muted font-semibold">Perfil:</span>
              {activeDoctorId ? (() => {
                const activeDoc = doctors.find(d => d.id === activeDoctorId);
                const isAdminUser = typeof window !== "undefined" && localStorage.getItem("role") === "admin";
                if (!isAdminUser) {
                  return (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-clinical-surface border border-clinical-border text-xs font-semibold text-clinical-text select-none">
                      <span className="w-5 h-5 rounded-full bg-clinical-teal/20 text-clinical-teal flex items-center justify-center text-[9px] font-bold border border-clinical-teal/30 shrink-0">
                        {activeDoc ? getInitials(activeDoc.name) : "??"}
                      </span>
                      <span>{activeDoc ? activeDoc.name : "Cargando..."}</span>
                    </div>
                  );
                }
                return (
                  <button
                    onClick={() => setIsDoctorModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-clinical-surface border border-clinical-border hover:border-clinical-teal/40 hover:bg-clinical-teal/5 transition-all text-xs font-semibold text-clinical-text cursor-pointer select-none"
                  >
                    <span className="w-5 h-5 rounded-full bg-clinical-teal/20 text-clinical-teal flex items-center justify-center text-[9px] font-bold border border-clinical-teal/30 shrink-0">
                      {activeDoc ? getInitials(activeDoc.name) : "??"}
                    </span>
                    <span>{activeDoc ? activeDoc.name : "Cargando..."}</span>
                    <ChevronDown className="w-3 h-3 text-clinical-text-muted" />
                  </button>
                );
              })() : (
                typeof window !== "undefined" && localStorage.getItem("role") === "admin" ? (
                  <button
                    onClick={() => setIsDoctorModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clinical-danger-bg border border-clinical-danger-border hover:border-clinical-teal/40 hover:bg-clinical-teal/5 text-clinical-danger-text transition-all text-xs font-semibold cursor-pointer select-none"
                  >
                    <Stethoscope className="w-4 h-4 mr-0.5 text-clinical-danger-text" />
                    <span>Seleccionar Médico</span>
                    <ChevronDown className="w-3 h-3 text-clinical-danger-text" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-clinical-surface border border-clinical-border text-xs font-semibold text-clinical-text select-none">
                    <span>Sin médico asignado</span>
                  </div>
                )
              )}
            </div>

            <button
              onClick={handleNewReport}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all"
            >
              Nuevo informe
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Zona del Tablero Principal */}
        <section className={`flex-1 transition-all duration-300 ${isMaximized ? 'p-0 flex flex-col h-full' : 'p-3 xl:p-4 2xl:p-6 grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 2xl:gap-6 overflow-y-auto xl:overflow-hidden min-h-0'}`}>

          {/* Columna Izquierda: Controles del Dictador */}
          <div className={`space-y-3 xl:space-y-4 2xl:space-y-6 flex flex-col h-auto xl:h-full transition-all duration-300 ${isMaximized ? 'hidden opacity-0 pointer-events-none' : 'opacity-100 min-h-0'}`}>
            
            {/* Card 1: Botón de Grabación y Transcripción */}
            <div className="bg-clinical-panel border border-clinical-border rounded-xl p-4 flex flex-col relative overflow-hidden shrink-0 shadow-lg">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    isPaused 
                      ? 'bg-amber-500 animate-pulse' 
                      : isRecording 
                        ? (mode === 'correct' ? 'bg-emerald-500 animate-led-glow' : 'bg-rose-500 animate-led-glow') 
                        : 'bg-slate-500'
                  } transition-all`}></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-clinical-text-muted">
                    {isPaused
                      ? 'Dictado en Pausa'
                      : isRecording 
                        ? (mode === 'correct' ? 'Modo Corrección (Grabando)' : 'Modo Dictado Principal (Grabando)') 
                        : (mode === 'correct' ? 'Modo Corrección' : 'Modo Dictado Principal')}
                  </span>
                </div>
                {/* Micro-animación de onda o estado */}
                <div className="h-4 flex items-center gap-1">
                  {isRecording && !isPaused ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1 h-full rounded-full bg-clinical-teal audio-bar"
                        style={{ height: `${AUDIO_WAVE_HEIGHTS[i % AUDIO_WAVE_HEIGHTS.length]}%` }}
                      ></span>
                    ))
                  ) : isPaused ? (
                    <span className="text-[10px] text-amber-400 font-semibold animate-pulse">Pausado</span>
                  ) : isTranscribing ? (
                    <span className="text-[10px] text-clinical-teal italic animate-pulse">Transcribiendo...</span>
                  ) : (
                    <span className="text-[10px] text-clinical-text-muted">Micrófono inactivo</span>
                  )}
                </div>
              </div>

              {/* Botones de Acción: Dictar / Detener + Pausar/Reanudar + Subir Audio */}
              <div className={`grid ${isRecording ? 'grid-cols-3' : 'grid-cols-2'} gap-2 transition-all`}>
                {!isRecording ? (
                  /* Botón Dictar por Voz */
                  <button
                    onClick={startRecording}
                    disabled={!isSpeechSupported || isTranscribing}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer bg-clinical-teal/5 hover:bg-clinical-teal/15 border-clinical-teal/30 text-clinical-teal hover:border-clinical-teal/50 ${!isSpeechSupported || isTranscribing ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <Mic className="w-6 h-6" />
                    <span className="text-[11px] font-bold leading-tight text-center">
                      Dictar
                    </span>
                  </button>
                ) : (
                  <>
                    {/* Botón Detener */}
                    <button
                      onClick={stopRecording}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer bg-rose-600/15 border-rose-500 text-rose-400 hover:bg-rose-600/25"
                      title="Detener y finalizar grabación"
                    >
                      <Square className="w-6 h-6 fill-current animate-pulse text-rose-400" />
                      <span className="text-[11px] font-bold leading-tight text-center truncate w-full">
                        Detener ({formatTime(recordingSeconds)})
                      </span>
                    </button>

                    {/* Botón Pausar / Reanudar */}
                    <button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer ${
                        isPaused
                          ? "bg-amber-500/15 border-amber-500 text-amber-400 hover:bg-amber-500/25 animate-pulse"
                          : "bg-amber-500/10 border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                      }`}
                      title={isPaused ? "Reanudar dictado" : "Pausar dictado"}
                    >
                      {isPaused ? (
                        <Play className="w-6 h-6 fill-current" />
                      ) : (
                        <Pause className="w-6 h-6 fill-current" />
                      )}
                      <span className="text-[11px] font-bold leading-tight text-center">
                        {isPaused ? "Reanudar" : "Pausar"}
                      </span>
                    </button>
                  </>
                )}

                {/* Botón Subir Audio */}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.webm,.m4a,.flac,.aac,.wma,.mp4,.mpeg,audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                  id="audio-upload"
                />
                <button
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isRecording || isTranscribing}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 bg-clinical-surface/50 hover:bg-clinical-surface-hover border-clinical-border hover:border-clinical-text-muted/40 text-clinical-text transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isTranscribing ? (
                    <span className="w-6 h-6 rounded-full border-2 border-clinical-teal border-t-transparent animate-spin"></span>
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                  <span className="text-[11px] font-bold leading-tight text-center truncate w-full">
                    {isTranscribing ? "Procesando..." : audioFileName ? audioFileName : "Subir Audio"}
                  </span>
                </button>
              </div>
            </div>

            {/* Card 2: Editor de Entrada Manual / Transcrita */}
            <div className="bg-clinical-panel border border-clinical-border rounded-xl p-4 flex flex-col h-auto xl:flex-1 shadow-lg relative xl:min-h-0">
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-wide uppercase text-clinical-teal">
                  {mode === "correct" ? "Corrección a Aplicar" : "Dictado del Estudio (Bruto)"}
                </span>
                
                <button
                  onClick={() => mode === "correct" ? setCorrectionInstruction("") : setRawText("")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-clinical-surface/80 hover:bg-clinical-danger-bg border border-clinical-border/80 hover:border-clinical-danger-border text-[11px] font-semibold text-clinical-danger-text transition-all cursor-pointer shadow-sm focus:outline-none"
                  aria-label={mode === "correct" ? "Borrar corrección" : "Borrar dictado"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Borrar
                </button>
              </div>

              {/* Textarea Principal */}
              {mode === "correct" ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <textarea
                    value={correctionInstruction}
                    onChange={(e) => setCorrectionInstruction(e.target.value)}
                    placeholder="Ej: 'En el informe cambiar el apéndice cecal a 10 mm y en la conclusión alertar riesgo de perforación'"
                    className="flex-1 min-h-[120px] md:min-h-0 bg-clinical-surface-inset/40 border border-clinical-border rounded-xl p-3 text-sm md:text-xs resize-none focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-medium leading-relaxed overflow-y-auto"
                  ></textarea>
                  
                  {interimTranscript && (
                    <div className="mt-1.5 p-2 rounded border border-clinical-teal/10 bg-clinical-teal/5 text-[10px] text-clinical-teal italic">
                      🎤 Transcribiendo: &quot;{interimTranscript}&quot;
                    </div>
                  )}

                  <button
                    onClick={handleApplyCorrection}
                    disabled={isLoading || !correctionInstruction?.trim()}
                    className="w-full mt-3 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs shrink-0"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generar informe con IA
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Escriba o presione el botón de micrófono para dictar el estudio de imagen..."
                    className="flex-1 min-h-[120px] md:min-h-0 bg-clinical-surface-inset/40 border border-clinical-border rounded-xl p-3 text-sm md:text-xs resize-none focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-medium leading-relaxed overflow-y-auto"
                  ></textarea>

                  {interimTranscript && (
                    <div className="mt-1.5 p-2 rounded border border-clinical-teal/10 bg-clinical-teal/5 text-[10px] text-clinical-teal italic">
                      🎤 Transcribiendo: &quot;{interimTranscript}&quot;
                    </div>
                  )}

                  <button
                    onClick={handleStructureReport}
                    disabled={isLoading || !rawText?.trim()}
                    className="w-full mt-3 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs shrink-0"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Informar con AI
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Mensajes de Error */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-clinical-danger-bg border border-clinical-danger-border text-xs text-clinical-danger-text font-medium">
                  ⚠️ {error}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Visor del Informe Estructurado */}
          <div className={`bg-clinical-panel border-clinical-border flex flex-col shadow-lg relative transition-all duration-300 ${
            isMaximized 
              ? 'flex-1 h-full w-full rounded-none border-0 p-8 md:p-10' 
              : 'rounded-xl p-4 h-auto xl:h-full xl:min-h-0 border'
          }`}>
            
            {/* Header del Visor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-clinical-border mb-3 gap-2">
              <div className="shrink-0">
                <span className="text-xs font-bold tracking-wide uppercase text-clinical-teal">Informe Editable</span>
                <p className="text-[10px] text-clinical-text-muted mt-0.5 hidden sm:block">Estructura del estudio según normativas de Imagen Diagnóstica</p>
              </div>

              {/* Acciones — scroll horizontal en móvil */}
              <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1">
                {/* Deshacer (Undo) */}
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="w-8 h-8 flex items-center justify-center rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0"
                  title="Deshacer (Ctrl+Z)"
                  aria-label="Deshacer"
                >
                  <Undo2 className="w-4 h-4" />
                </button>

                {/* Rehacer (Redo) */}
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= reportHistory.length - 1}
                  className="w-8 h-8 flex items-center justify-center rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0"
                  title="Rehacer (Ctrl+Y)"
                  aria-label="Rehacer"
                >
                  <Redo2 className="w-4 h-4" />
                </button>

                <span className="w-[1px] h-5 bg-clinical-border mx-1 shrink-0" />

                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className={`w-8 h-8 flex items-center justify-center rounded border transition-all shrink-0 cursor-pointer ${
                    isMaximized
                      ? "bg-clinical-danger-bg border-clinical-danger-border text-clinical-danger-text hover:brightness-110"
                      : "bg-clinical-surface hover:bg-clinical-surface-hover border-clinical-border text-clinical-text"
                  }`}
                  title={isMaximized ? "Contraer" : "Maximizar"}
                  aria-label={isMaximized ? "Contraer" : "Maximizar"}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Copiar Button */}
                <button
                  onClick={handleCopyClipboard}
                  disabled={!structuredReport}
                  className="w-8 h-8 flex items-center justify-center rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title={copySuccess ? "¡Copiado!" : "Copiar"}
                  aria-label="Copiar al portapapeles"
                >
                  {copySuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                {/* Limpiar Button */}
                <button
                  onClick={handleClearEditor}
                  disabled={!structuredReport || structuredReport.trim() === ""}
                  className="w-8 h-8 flex items-center justify-center rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title="Limpiar"
                  aria-label="Limpiar texto del informe"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>

              </div>
            </div>

            {/* Editor del Reporte */}
            <div className="flex-1 flex flex-col bg-clinical-surface-inset/40 border border-clinical-border rounded-xl overflow-hidden relative min-h-0">
              {isLoading && (
                <div className="absolute inset-0 bg-slate-950/70 z-10 flex flex-col items-center justify-center gap-3">
                  <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
                   <p className="text-xs text-clinical-teal font-semibold tracking-wide">Estructurando reporte con {activeAiModel?.startsWith("gemini") ? "Gemini" : activeAiModel?.startsWith("chatgpt") || activeAiModel?.startsWith("openai") || activeAiModel?.startsWith("gpt") ? "ChatGPT" : "IA"}...</p>
                </div>
              )}
              {/* Editor Toolbar */}
              {/* Editor Toolbar */}
              <div className="flex items-center gap-1.5 p-2 bg-clinical-surface border-b border-clinical-border shrink-0 font-sans select-none">
                {/* Bold Button */}
                {/* Bold Button */}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    document.execCommand('bold', false);
                    handleEditorInput();
                  }}
                  className="p-1.5 rounded hover:bg-clinical-surface-hover text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                  title="Negrita"
                  aria-label="Formato negrita"
                >
                  <Bold className="w-4 h-4" />
                </button>
                {/* Cursiva Button */}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    document.execCommand('italic', false);
                    handleEditorInput();
                  }}
                  className="p-1.5 rounded hover:bg-clinical-surface-hover text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                  title="Cursiva"
                  aria-label="Formato cursiva"
                >
                  <Italic className="w-4 h-4" />
                </button>

                {/* Subrayado Button */}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    document.execCommand('underline', false);
                    handleEditorInput();
                  }}
                  className="p-1.5 rounded hover:bg-clinical-surface-hover text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                  title="Subrayado"
                  aria-label="Formato subrayado"
                >
                  <Underline className="w-4 h-4" />
                </button>

                {/* Alignment buttons */}
                <span className="w-[1px] h-5 bg-clinical-border mx-1 shrink-0" />

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    document.execCommand('justifyLeft', false);
                    handleEditorInput();
                  }}
                  className="p-1.5 rounded hover:bg-clinical-surface-hover text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                  title="Alinear a la izquierda"
                  aria-label="Alinear a la izquierda"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    document.execCommand('justifyCenter', false);
                    handleEditorInput();
                  }}
                  className="p-1.5 rounded hover:bg-clinical-surface-hover text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                  title="Centrar"
                  aria-label="Centrar texto"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    document.execCommand('justifyRight', false);
                    handleEditorInput();
                  }}
                  className="p-1.5 rounded hover:bg-clinical-surface-hover text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                  title="Alinear a la derecha"
                  aria-label="Alinear a la derecha"
                >
                  <AlignRight className="w-4 h-4" />
                </button>

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    document.execCommand('justifyFull', false);
                    handleEditorInput();
                  }}
                  className="p-1.5 rounded hover:bg-clinical-surface-hover text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                  title="Justificar"
                  aria-label="Justificar texto"
                >
                  <AlignJustify className="w-4 h-4" />
                </button>

                <span className="w-[1px] h-5 bg-slate-800 mx-1 shrink-0" />

                {/* Custom Font Size Dropdown */}
                <div className="relative">
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      // Guardar la selección activa del editor antes de que el click la pierda
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
                        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                      }
                    }}
                    onClick={() => setIsFontSizeOpen(!isFontSizeOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all cursor-pointer"
                    aria-label="Tamaño de fuente"
                  >
                    <span>{currentFontSize}</span>
                    <ChevronDown className="w-3 h-3 text-clinical-text-muted" />
                  </button>
                  {isFontSizeOpen && (
                    <div className="absolute left-0 mt-1 w-28 bg-clinical-panel border border-clinical-border rounded-lg shadow-xl py-1 z-30 animate-in fade-in slide-in-from-top-1 duration-100">
                      {['9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt'].map((size) => (
                        <button
                          key={size}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleFontSizeChange(size);
                            setIsFontSizeOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-clinical-surface-hover text-xs text-clinical-text transition-all cursor-pointer"
                        >
                          {size === '11pt' ? '11 pt (Def.)' : size.replace('pt', ' pt')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div
                key="editor"
                ref={editorRef}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleEditorInput}
                className="report-paper flex-1 h-auto xl:h-full overflow-y-visible xl:overflow-y-auto p-8 md:p-10 select-text cursor-text outline-none focus:ring-1 focus:ring-clinical-teal/30 transition-all"
                style={{ backgroundColor: "#ffffff", color: "#000000" }}
              ></div>
            </div>

            {/* Info inferior de ayuda */}
            <div className="mt-4 text-[10px] text-clinical-text-muted flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-clinical-teal shrink-0" />
              <span>El informe es 100% editable manualmente. Puede realizar cambios directamente en el texto final.</span>
            </div>
          </div>
        </section>
      </main>




      <DictadorModals
        isTemplateErrorModalOpen={isTemplateErrorModalOpen}
        setIsTemplateErrorModalOpen={setIsTemplateErrorModalOpen}
        missingTemplateName={missingTemplateName}
        onNavigateTemplates={() => router.push('/templates')}
        isAiWarningModalOpen={isAiWarningModalOpen}
        setIsAiWarningModalOpen={setIsAiWarningModalOpen}
        aiWarningModalMessage={aiWarningModalMessage}
        isDoctorModalOpen={isDoctorModalOpen}
        setIsDoctorModalOpen={setIsDoctorModalOpen}
        activeDoctorId={activeDoctorId}
        doctors={doctors}
        doctorSearchTerm={doctorSearchTerm}
        setDoctorSearchTerm={setDoctorSearchTerm}
        onSelectDoctor={(doc) => {
          setActiveDoctorId(doc.id);
          setDetectedDoctorId(doc.id);
          setDetectedDoctorName(doc.name);
          setDetectedDoctorSpecialty(doc.specialty);
          setIsDoctorModalOpen(false);
        }}
        showMicWarning={showMicWarning}
        setShowMicWarning={setShowMicWarning}
        micWarningDetails={micWarningDetails}
        isAiModalOpen={isAiModalOpen}
        setIsAiModalOpen={setIsAiModalOpen}
        activeAiModel={activeAiModel}
        selectAiProvider={selectAiProvider}
        aiErrorDetails={aiErrorDetails}
        setAiErrorDetails={setAiErrorDetails}
        getAiProviderInfo={getAiProviderInfo}
        copySuccess={copySuccess}
      />
    </div>
  );
}

