
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";

import { Company, Doctor, Report, SpeechRecognitionInstance, SpeechRecognitionEvent } from "@/types";
import { sanitizeHtml } from "@/utils/sanitize";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";

/**
 * Convierte el contenido HTML enriquecido del editor contentEditable de vuelta a Markdown estándar (con **)
 */
const convertHtmlToMarkdown = (html: string): string => {
  if (!html) return "";

  let text = html;

  // Normalizar saltos de línea de retorno de carro
  text = text.replace(/\r\n/g, "\n");

  // Reemplazar divs y párrafos por salto de línea simple para evitar el doble espaciado acumulativo
  // 1. Detectar alineaciones en párrafos y divs antes de borrarlos
  text = text.replace(/<(p|div)\s+[^>]*style=["']([^"']*)text-align:\s*(center|left|right|justify);?([^"']*)["'][^>]*>(.*?)<\/\1>/gi, '[ALIGN:$3]$5[/ALIGN]\n');
  text = text.replace(/<(p|div)\s+[^>]*align=["'](center|left|right|justify)["'][^>]*>(.*?)<\/\1>/gi, '[ALIGN:$2]$3[/ALIGN]\n');

  text = text.replace(/<div[^>]*>/gi, "");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n");

  // Reemplazar saltos de línea <br> por salto de línea simple
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 2. Extraer cursiva (font-style: italic) de spans
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)font-style:\s*italic;?([^"']*)["']([^>]*)>(.*?)<\/span>/gi, (match, beforeAttr, styleBefore, styleAfter, afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}${afterAttr}><em>${content}</em></span>`;
  });

  // 3. Extraer subrayado (text-decoration: underline) de spans
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)text-decoration:\s*underline;?([^"']*)["']([^>]*)>(.*?)<\/span>/gi, (match, beforeAttr, styleBefore, styleAfter, afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}${afterAttr}><u>${content}</u></span>`;
  });

  // 4. Extraer negrita (font-weight: bold / 700) de spans
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)font-weight:\s*(?:bold|700);?([^"']*)["']([^>]*)>(.*?)<\/span>/gi, (match, beforeAttr, styleBefore, styleAfter, afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}${afterAttr}><strong>${content}</strong></span>`;
  });

  // Reemplazar <strong> y <b> por **
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");

  // Reemplazar <em> y <i> por *
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Preservar spans de tamaño de fuente convirtiéndolos a un marcador temporal antes de la limpieza del HTML residual
  let previousText;
  do {
    previousText = text;
    text = text.replace(/<span\s+[^>]*style=["'](?:[^"']*;)*\s*font-size:\s*([^;"'\s]+)[^"']*["'][^>]*>(.*?)<\/span>/gi, '[FONTSIZE:$1]$2[/FONTSIZE]');
  } while (text !== previousText);

  // Preservar subrayado convirtiéndolo a un marcador temporal para evitar que la limpieza de HTML lo borre
  text = text.replace(/<u[^>]*>(.*?)<\/u>/gi, '[UNDERLINE]$1[/UNDERLINE]');

  // Quitar cualquier otra etiqueta HTML residual
  text = text.replace(/<[^>]+>/g, "");

  // Restaurar los marcadores de font-size a etiquetas HTML limpias para guardarlas en el markdown
  do {
    previousText = text;
    text = text.replace(/\[FONTSIZE:([^\]]+)\](.*?)\[\/FONTSIZE\]/g, '<span style="font-size: $1">$2</span>');
  } while (text !== previousText);

  // Restaurar subrayado a etiquetas <u>
  do {
    previousText = text;
    text = text.replace(/\[UNDERLINE\](.*?)\[\/UNDERLINE\]/g, '<u>$1</u>');
  } while (text !== previousText);

  // Restaurar alineaciones a párrafos con estilo inline
  do {
    previousText = text;
    text = text.replace(/\[ALIGN:([^\]]+)\](.*?)\[\/ALIGN\]/g, '<p style="text-align: $1">$2</p>');
  } while (text !== previousText);

  // Decodificar entidades HTML comunes
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Limpiar espacios vacíos en las líneas
  text = text.split("\n").map(line => line.trim() === "" ? "" : line).join("\n");

  // Normalizar múltiples saltos de línea seguidos
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
};

// Limpieza para comparar HTML y evitar bucles de actualización
const cleanHtmlForComparison = (html: string): string => {
  let cleaned = html.replace(/\s+/g, "");
  
  // Normalizar el atributo style reteniendo únicamente font-size y font-style
  cleaned = cleaned.replace(/style="([^"]*)"/g, (match, styleContent) => {
    const fontSizeMatch = styleContent.match(/font-size:\s*([^;"]+)/);
    const fontStyleMatch = styleContent.match(/font-style:\s*([^;"]+)/);
    let normalizedStyle = "";
    if (fontSizeMatch) normalizedStyle += `font-size:${fontSizeMatch[1].trim()};`;
    if (fontStyleMatch) normalizedStyle += `font-style:${fontStyleMatch[1].trim()};`;
    return normalizedStyle ? `style="${normalizedStyle}"` : "";
  });

  return cleaned
    .replace(/class="[^"]*"/g, "")
    .replace(/&nbsp;/g, "")
    .replace(/<br\/?>/g, "\n")
    .replace(/<u>/g, "")
    .replace(/<\/u>/g, "")
    .replace(/<strong>/g, "")
    .replace(/<\/strong>/g, "")
    .replace(/<b>/g, "")
    .replace(/<\/b>/g, "")
    .trim();
};

// Convertir el texto del informe a HTML formateado para el editor contentEditable de la app
const convertReportToHtml = (text: string): string => {
  if (!text || typeof text !== "string") return "";

  const cleanText = text.replace(/```html/g, "").replace(/```/g, "").replace(/\t/g, " ").trim();
  const normalizedText = cleanText.replace(/\r\n/g, "\n");
  const lines = normalizedText.split("\n");

  // Buscar la primera línea no vacía para tratarla como título
  let firstNonEmptyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "") {
      firstNonEmptyIdx = i;
      break;
    }
  }

  const htmlLines = lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      // Línea vacía -> párrafo con &nbsp; para preservar la separación de bloque
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: #ffffff;">&nbsp;</p>`;
    }

    const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed);
    const isTitle = idx === firstNonEmptyIdx && isFullyBold;

    if (isTitle) {
      const titleText = trimmed.replace(/^\*\*|\*\*$/g, "");
      const emptyLine = `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: #ffffff;">&nbsp;</p>`;
      const titleHtml = `<p align="center" style="text-align: center; font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; background-color: #ffffff;"><u><strong>${titleText}</strong></u></p>`;
      return `${emptyLine}${titleHtml}`;
    } else if (isFullyBold) {
      const headerText = trimmed.replace(/^\*\*|\*\*$/g, "");
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: #ffffff;"><strong>${headerText}</strong></p>`;
    } else {
      let formattedLine = trimmed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      formattedLine = formattedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: #ffffff;">${formattedLine}</p>`;
    }
  });

  return `<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; background-color: #ffffff; line-height: 1.15; padding: 8px; text-align: left;">${htmlLines.join("")}</div>`;
};

/**
 * Genera HTML MÍNIMO y limpio para copiar al portapapeles y pegar en editores de texto
 * enriquecido (Word online, editores clínicos).
 * Usa inline styles específicos para forzar la tipografía Arial 11pt, color negro,
 * fondo blanco y espaciado de párrafos para evitar que se colasen.
 */
const convertReportToClipboardHtml = (text: string): string => {
  if (!text || typeof text !== "string") return "";

  const cleanText = text.replace(/```html/g, "").replace(/```/g, "").replace(/\t/g, " ");
  const normalizedText = cleanText.replace(/\r\n/g, "\n");
  const lines = normalizedText.split("\n");

  // Buscar la primera línea no vacía para tratarla como título
  let firstNonEmptyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "") {
      firstNonEmptyIdx = i;
      break;
    }
  }

  const htmlLines = lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      // Línea vacía -> párrafo con &nbsp; para preservar la separación de bloque
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: transparent;">&nbsp;</p>`;
    }

    const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed);
    const isTitle = idx === firstNonEmptyIdx && isFullyBold;

    if (isTitle) {
      const titleText = trimmed.replace(/^\*\*|\*\*$/g, "");
      const emptyLine = `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: transparent;">&nbsp;</p>`;
      const titleHtml = `<p align="center" style="text-align: center; font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; background-color: transparent;"><u><strong>${titleText}</strong></u></p>`;
      return `${emptyLine}\n${titleHtml}`;
    } else if (isFullyBold) {
      const headerText = trimmed.replace(/^\*\*|\*\*$/g, "");
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: transparent;"><strong>${headerText}</strong></p>`;
    } else {
      let formattedLine = trimmed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      formattedLine = formattedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: transparent;">${formattedLine}</p>`;
    }
  });

  const content = htmlLines.join("\n");
  // Retornar el HTML envuelto en la firma interna de Google Docs para activar los filtros limpios
  // de importación en editores RTE clínicos y Word, evitando fondos oscuros o bordes.
  return `<b id="docs-internal-guid-clinical-report" style="font-weight:normal;">\n<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; background-color: #ffffff; padding: 12pt; line-height: 1.15; text-align: left;">\n${content}\n</div>\n</b>`;
};

const AUDIO_WAVE_HEIGHTS = [30, 80, 45, 90, 60, 75, 40, 85, 50, 70];

const getInitials = (name: string): string => {
  if (!name) return "";
  // Quitar prefijos comunes como Dr., Dra., etc.
  const cleanName = name.replace(/^(dr\.|dra\.|dr|dra)\s+/gi, "").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function DictationPage() {
  const router = useRouter();
  // Resolver API_URL de forma dinámica en red local para evitar fallas al conectar desde otros dispositivos
  const API_URL = "";
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const isRecordingRef = useRef(false);
  const [mode, setMode] = useState<"dictate" | "correct">("dictate");
  const [rawText, setRawText] = useState("");
  const [correctionInstruction, setCorrectionInstruction] = useState("");
  const [structuredReport, setStructuredReport] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>("base");
  const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("11 pt");
  const savedRangeRef = useRef<Range | null>(null);

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

  const applyTheme = (theme: any) => {
    const root = document.documentElement;
    const isColorLight = (hex: string): boolean => {
      if (!hex) return false;
      const cleanHex = hex.replace("#", "");
      if (cleanHex.length !== 6 && cleanHex.length !== 3) return false;
      
      let r = 0, g = 0, b = 0;
      if (cleanHex.length === 6) {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
      } else {
        r = parseInt(cleanHex.charAt(0) + cleanHex.charAt(0), 16);
        g = parseInt(cleanHex.charAt(1) + cleanHex.charAt(1), 16);
        b = parseInt(cleanHex.charAt(2) + cleanHex.charAt(2), 16);
      }
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 140;
    };

    const allVars = [
      "--clinical-bg", "--clinical-panel", "--clinical-panel-light",
      "--clinical-teal", "--clinical-teal-dim",
      "--clinical-text", "--clinical-text-muted",
      "--clinical-surface", "--clinical-surface-hover", "--clinical-surface-inset",
      "--clinical-border", "--clinical-border-subtle",
    ];

    if (theme) {
      if (theme.primary) {
        root.style.setProperty("--clinical-bg", theme.primary);
        if (isColorLight(theme.primary)) {
          root.style.setProperty("--clinical-text", "#0f172a");
          root.style.setProperty("--clinical-text-muted", "#475569");
          root.style.setProperty("--clinical-surface", "#e2e8f0");
          root.style.setProperty("--clinical-surface-hover", "#cbd5e1");
          root.style.setProperty("--clinical-surface-inset", "#f1f5f9");
          root.style.setProperty("--clinical-border", "#cbd5e1");
          root.style.setProperty("--clinical-border-subtle", "#e2e8f0");
        } else {
          ["--clinical-text", "--clinical-text-muted", "--clinical-surface", "--clinical-surface-hover", "--clinical-surface-inset", "--clinical-border", "--clinical-border-subtle"].forEach(v => root.style.removeProperty(v));
        }
      }
      if (theme.secondary) {
        root.style.setProperty("--clinical-panel", theme.secondary);
        root.style.setProperty("--clinical-panel-light", `${theme.secondary}cc`);
      }
      if (theme.accent) {
        root.style.setProperty("--clinical-teal", theme.accent);
        root.style.setProperty("--clinical-teal-dim", `${theme.accent}cc`);
      }
    } else {
      allVars.forEach(v => root.style.removeProperty(v));
    }
  };

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
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        setCompanyLogo(null);
        setCompanyName(null);
        setSelectedPreviewCompanyId("base");
      }
    }
  }, [isInitialized]);
  
  // Estados para modal de login/selección obligatoria de médico
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [isTemplateErrorModalOpen, setIsTemplateErrorModalOpen] = useState(false);
  const [missingTemplateName, setMissingTemplateName] = useState("");
  const [doctorSearchTerm, setDoctorSearchTerm] = useState("");

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      setRecordingSeconds(0);
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

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
        updateReportState(sessionData.structuredReport || "", "direct");
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

  // Lógica de grabación por voz (Speech Recognition)
  const startRecording = async () => {
    setError(null);

    // Limpiar texto previo al iniciar un nuevo dictado por voz
    if (mode === "dictate") {
      setRawText("");
    } else {
      setCorrectionInstruction("");
    }

    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setError("La API de voz no está soportada en este navegador. Use Google Chrome.");
      return;
    }

    // Verificar si navigator.mediaDevices no está disponible
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerMicWarning('notFound');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Liberar el stream inmediatamente; solo lo necesitamos para obtener el permiso
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
            setRawText((prev) => (prev ? prev + " " + final : final));
          } else {
            setCorrectionInstruction((prev) => (prev ? prev + " " + final : final));
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
        if (isRecordingRef.current) {
          try {
            rec.start();
          } catch (err) {
            console.error("Failed to restart speech recognition:", err);
            setIsRecording(false);
            isRecordingRef.current = false;
            setInterimTranscript("");
          }
        } else {
          setIsRecording(false);
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
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const resetSilenceTimeout = (ms: number = 2000) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
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

    // Limpiar texto previo al cargar un nuevo archivo de audio
    if (mode === "dictate") {
      setRawText("");
    } else {
      setCorrectionInstruction("");
    }

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
      const transcription = data.text;

      if (mode === "dictate") {
        setRawText((prev) => (prev ? prev + " " + transcription : transcription));
      } else {
        setCorrectionInstruction((prev) => (prev ? prev + " " + transcription : transcription));
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
    if (!rawText.trim()) {
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
          // Vercel puede devolver HTML en lugar de JSON al timeout (504)
          throw new Error(`Error del servidor (${res.status}). Intente nuevamente.`);
        }
        if (data.code === 'TEMPLATE_NOT_FOUND') {
          setMissingTemplateName(data.query || rawText);
          setIsTemplateErrorModalOpen(true);
        }
        throw new Error(data.error || "Fallo en la estructuración.");
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("La respuesta del servidor no es válida. Intente nuevamente.");
      }

      const structuredText = data?.structuredText || data?.structuredReport || "";
      if (!structuredText || typeof structuredText !== "string" || structuredText.trim().length === 0) {
        throw new Error("La IA no generó un informe válido. Intente nuevamente.");
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
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };


  // Enviar corrección incremental
  const handleApplyCorrection = async () => {
    if (!correctionInstruction.trim()) {
      setError("Por favor escriba o dicte la corrección a aplicar.");
      return;
    }
    if (!structuredReport) {
      setError("Primero debe generar un informe estructurado antes de aplicar correcciones.");
      return;
    }

    // Extraer texto plano del HTML para enviar al backend de IA
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizeHtml(structuredReport);
    // Convertir <strong> a ** para que la IA reconozca la estructura
    tempDiv.querySelectorAll('strong, b').forEach(el => {
      el.replaceWith(`**${el.textContent}**`);
    });
    const plainReportForAI = tempDiv.innerText || tempDiv.textContent || '';

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
          throw new Error(`Error del servidor (${res.status}). Intente nuevamente.`);
        }
        throw new Error(data.error || "Fallo al aplicar corrección.");
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("La respuesta del servidor no es válida. Intente nuevamente.");
      }

      const correctedText = data?.structuredText || data?.structuredReport || "";
      if (!correctedText || typeof correctedText !== "string" || correctedText.trim().length === 0) {
        throw new Error("La IA no generó una corrección válida. Intente nuevamente.");
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
    setIsEditorOpen(false);
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-clinical-text-muted">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                );
              })() : (
                typeof window !== "undefined" && localStorage.getItem("role") === "admin" ? (
                  <button
                    onClick={() => setIsDoctorModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/20 border border-rose-900/30 hover:border-clinical-teal/40 hover:bg-clinical-teal/5 text-rose-300 transition-all text-xs font-semibold cursor-pointer select-none"
                  >
                    <span>🩺 Seleccionar Médico</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Zona del Tablero Principal */}
        <section className={`flex-1 transition-all duration-300 ${isMaximized ? 'p-0 flex flex-col h-full' : 'p-3 xl:p-4 2xl:p-6 grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4 2xl:gap-6 overflow-y-auto xl:overflow-hidden min-h-0'}`}>

          {/* Columna Izquierda: Controles del Dictador */}
          <div className={`space-y-3 xl:space-y-4 2xl:space-y-6 flex flex-col h-full transition-all duration-300 ${isMaximized ? 'hidden opacity-0 pointer-events-none' : 'opacity-100 min-h-0'}`}>
            
            {/* Card 1: Botón de Grabación y Transcripción */}
            <div className="bg-clinical-panel border border-clinical-border rounded-xl p-4 flex flex-col relative overflow-hidden shrink-0 shadow-lg">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${mode === 'correct' ? 'bg-emerald-500 animate-led-glow' : 'bg-rose-500'} transition-all`}></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-clinical-text-muted">
                    {mode === 'correct' ? 'Modo Corrección' : 'Modo Dictado Principal'}
                  </span>
                </div>
                {/* Micro-animación de onda o estado */}
                <div className="h-4 flex items-center gap-1">
                  {isRecording ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1 h-full rounded-full bg-clinical-teal audio-bar"
                        style={{ height: `${AUDIO_WAVE_HEIGHTS[i % AUDIO_WAVE_HEIGHTS.length]}%` }}
                      ></span>
                    ))
                  ) : isTranscribing ? (
                    <span className="text-[10px] text-clinical-teal italic animate-pulse">Transcribiendo...</span>
                  ) : (
                    <span className="text-[10px] text-clinical-text-muted">Micrófono inactivo</span>
                  )}
                </div>
              </div>

              {/* Botones de Acción: Dictar + Subir Audio (siempre grid-2) */}
              <div className="grid grid-cols-2 gap-2">
                {/* Botón Dictar por Voz */}
                <button
                  onClick={toggleRecording}
                  disabled={!isSpeechSupported || isTranscribing}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer ${
                    isRecording
                      ? "bg-rose-600/15 border-rose-500 text-rose-400 animate-record-pulse"
                      : "bg-clinical-teal/5 hover:bg-clinical-teal/15 border-clinical-teal/30 text-clinical-teal hover:border-clinical-teal/50"
                  } ${!isSpeechSupported || isTranscribing ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {isRecording ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6 animate-pulse">
                      <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  )}
                  <span className="text-[11px] font-bold leading-tight text-center">
                    {isRecording ? `Grabando ${formatTime(recordingSeconds)}` : "Dictar"}
                  </span>
                </button>

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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                  )}
                  <span className="text-[11px] font-bold leading-tight text-center truncate w-full">
                    {isTranscribing ? "Procesando..." : audioFileName ? audioFileName : "Subir Audio"}
                  </span>
                </button>
              </div>
            </div>

            {/* Card 2: Editor de Entrada Manual / Transcrita */}
            <div className="bg-clinical-panel border border-clinical-border rounded-xl p-4 flex flex-col flex-1 shadow-lg relative min-h-0">
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-wide uppercase text-clinical-teal">
                  {mode === "correct" ? "Corrección a Aplicar" : "Dictado del Estudio (Bruto)"}
                </span>
                
                <button
                  onClick={() => mode === "correct" ? setCorrectionInstruction("") : setRawText("")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-clinical-surface/80 hover:bg-rose-950/40 border border-clinical-border/80 hover:border-rose-900/50 text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm focus:outline-none"
                  aria-label={mode === "correct" ? "Borrar corrección" : "Borrar dictado"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
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
                    disabled={isLoading || !correctionInstruction.trim()}
                    className="w-full mt-3 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs shrink-0"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                          <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
                          <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
                        </svg>
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
                    disabled={isLoading || !rawText.trim()}
                    className="w-full mt-3 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs shrink-0"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V18ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 16.312v-1.124A2.25 2.25 0 0 1 15.75 12.94h1.124m-1.124 3.372L13.5 14.25m2.25 2.062 2.25-2.062M20.25 14.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                        </svg>
                        Informar con AI
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Mensajes de Error */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-medium">
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  </svg>
                </button>

                {/* Rehacer (Redo) */}
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= reportHistory.length - 1}
                  className="w-8 h-8 flex items-center justify-center rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0"
                  title="Rehacer (Ctrl+Y)"
                  aria-label="Rehacer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                  </svg>
                </button>

                <span className="w-[1px] h-5 bg-clinical-border mx-1 shrink-0" />

                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className={`w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 rounded border text-xs font-semibold transition-all shrink-0 ${
                    isMaximized
                      ? "bg-rose-950/30 border-rose-900/50 text-rose-400 hover:bg-rose-950/50"
                      : "bg-clinical-surface hover:bg-clinical-surface-hover border-clinical-border text-clinical-text"
                  }`}
                  title={isMaximized ? "Restaurar tamaño normal" : "Maximizar área de edición"}
                >
                  {isMaximized ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25" />
                      </svg><span className="hidden sm:inline">Contraer</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h-4.5m4.5 0L15 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 15" />
                      </svg><span className="hidden sm:inline">Maximizar</span>
                    </>
                  )}
                </button>
                {/* Copiar Button */}
                <button
                  onClick={handleCopyClipboard}
                  disabled={!structuredReport}
                  className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h10.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6.75A1.5 1.5 0 0 1 5.25 21V9A1.5 1.5 0 0 1 6.75 7.5Z" />
                  </svg><span className="hidden sm:inline">{copySuccess ? "Copiado!" : "Copiar"}</span>
                </button>

                {/* Limpiar Button */}
                <button
                  onClick={handleClearEditor}
                  disabled={!isEditorOpen}
                  className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 rounded bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title="Limpiar texto del informe"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-rose-400 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg><span className="hidden sm:inline">Limpiar</span>
                </button>

              </div>
            </div>

            {/* Editor del Reporte */}
            <div className="flex-1 flex flex-col bg-clinical-surface-inset/40 border border-clinical-border rounded-xl overflow-hidden relative min-h-0">
              {isLoading && (
                <div className="absolute inset-0 bg-slate-950/70 z-10 flex flex-col items-center justify-center gap-3">
                  <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
                   <p className="text-xs text-clinical-teal font-semibold tracking-wide">Estructurando reporte con {activeAiModel?.startsWith("gemini") ? "Gemini" : activeAiModel?.startsWith("groq") ? "Groq" : "IA"}...</p>
                </div>
              )}
              {/* Editor Toolbar */}
              {isEditorOpen && (
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h4.5a3.75 3.75 0 0 1 0 7.5h-4.5m0-7.5v7.5m0-7.5h3.75M6.75 11.25h6a3.75 3.75 0 0 1 0 7.5h-6m0-7.5v7.5m0-7.5h3" />
                    </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4.5l-4 15m-1.5-15h4m-6 15h4" />
                    </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16" />
                    </svg>
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
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-clinical-text-muted">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
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
              )}
              {isEditorOpen ? (
                <div
                  key="editor"
                  ref={editorRef}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onInput={handleEditorInput}
                  className="report-paper flex-1 h-auto xl:h-full overflow-y-visible xl:overflow-y-auto p-8 md:p-10 select-text cursor-text outline-none focus:ring-1 focus:ring-clinical-teal/30 transition-all"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                ></div>
              ) : isLoading ? (
                <div key="loading" className="flex-1" />
              ) : (
                <div key="empty" className="flex-1 flex flex-col items-center justify-center text-center p-8 text-clinical-text-muted">
                  <div className="w-16 h-16 rounded-full bg-clinical-surface border border-clinical-border flex items-center justify-center mb-4 text-clinical-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm text-clinical-text">No hay informe estructurado</h3>
                  <p className="text-xs max-w-xs mt-2 leading-relaxed">
                    Dicte o escriba el informe en la columna izquierda y presione &quot;Informar con AI&quot; para estructurarlo.
                  </p>
                </div>
              )}
            </div>

            {/* Info inferior de ayuda */}
            <div className="mt-4 text-[10px] text-clinical-text-muted flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-clinical-teal shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0-3h.008v.008H12V9.75Zm0-4.853c-1.29 0-2.583.045-3.87.135a8.205 8.205 0 0 0-3.418 1.196L3.08 7.9c-.31.18-.432.553-.3.882l.988 2.502c.07.177.206.319.38.38l2.502.988c.329.132.702.01.882-.3l1.67-2.83a8.192 8.192 0 0 0 4.88 0l1.67 2.83c.18.31.553.432.882.3l2.502-.988c.174-.06.31-.203.38-.38l.988-2.502c.132-.329.01-.702-.3-.882l-1.638-1.737a8.204 8.204 0 0 0-3.417-1.196 48.57 48.57 0 0 0-3.87-.135Z" />
              </svg>
              <span>El informe es 100% editable manualmente. Puede realizar cambios directamente en el texto final.</span>
            </div>
          </div>
        </section>
      </main>



      {/* Modal de Error de Plantilla No Encontrada */}
      {isTemplateErrorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-clinical-panel border border-clinical-border rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-clinical-border mb-4 shrink-0">
              <h3 className="font-bold text-base text-clinical-text tracking-wide flex items-center gap-2">
                <span className="text-rose-500">⚠️</span> Plantilla No Encontrada
              </h3>
              <button
                onClick={() => setIsTemplateErrorModalOpen(false)}
                className="p-1 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
                aria-label="Cerrar modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
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
                  <span className="font-semibold text-rose-300">
                    "{missingTemplateName}"
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
                  router.push('/templates');
                }}
                className="flex-1 py-2 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <span>Verificar</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Advertencia de Micrófono / Permisos (Milestone 5) */}
      {/* Modal de Selección Obligatoria de Médico */}
      {isDoctorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
             onKeyDown={(e) => {
               // Evitar cerrar con Escape si no hay médico seleccionado
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
                  <span>🩺</span> Seleccionar Perfil de Médico
                </h3>
                <p className="text-xs text-clinical-text-muted mt-1 leading-relaxed">
                  Para dictar, cargar audio o escribir informes, primero debe seleccionar su perfil profesional. Esto asegura cargar las plantillas correctas.
                </p>
              </div>
              {/* Botón de cerrar visible solo si ya tiene un médico seleccionado */}
              {activeDoctorId && (
                <button
                  onClick={() => setIsDoctorModalOpen(false)}
                  className="p-1.5 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Buscador de Médicos */}
            <div className="relative mb-6 shrink-0">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                </svg>
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
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
                          onClick={() => {
                            setActiveDoctorId(doc.id);
                            setDetectedDoctorId(doc.id);
                            setDetectedDoctorName(doc.name);
                            setDetectedDoctorSpecialty(doc.specialty);
                            setIsDoctorModalOpen(false);
                          }}
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

      {showMicWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-clinical-panel border border-clinical-border rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 border border-rose-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
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
    </div>
  );
}

