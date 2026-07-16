
"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { Eye, Copy, Pencil, Trash2, Maximize, Minimize, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import { Company, Doctor, DocumentItem } from "@/types";
import { sanitizeHtml } from "@/utils/sanitize";

const convertHtmlToMarkdown = (html: string): string => {
  if (!html) return "";
  let text = html;
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/<(p|div)\s+[^>]*style=["']([^"']*)text-align:\s*(center|left|right|justify);?([^"']*)["'][^>]*>(.*?)<\/\1>/gi, '[ALIGN:$3]$5[/ALIGN]\n');
  text = text.replace(/<(p|div)\s+[^>]*align=["'](center|left|right|justify)["'][^>]*>(.*?)<\/\1>/gi, '[ALIGN:$2]$3[/ALIGN]\n');
  text = text.replace(/<div[^>]*>/gi, "");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)font-style:\s*italic;?([^"']*)["']([^>]*)>(.*?)<\/span>/gi, (match, beforeAttr, styleBefore, styleAfter, afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}${afterAttr}><em>${content}</em></span>`;
  });
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)text-decoration:\s*underline;?([^"']*)["']([^>]*)>(.*?)<\/span>/gi, (match, beforeAttr, styleBefore, styleAfter, afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}${afterAttr}><u>${content}</u></span>`;
  });
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)font-weight:\s*(?:bold|700);?([^"']*)["']([^>]*)>(.*?)<\/span>/gi, (match, beforeAttr, styleBefore, styleAfter, afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}${afterAttr}><strong>${content}</strong></span>`;
  });
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
  let previousText;
  do {
    previousText = text;
    text = text.replace(/<span\s+[^>]*style=["'](?:[^"']*;)*\s*font-size:\s*([^;"'\s]+)[^"']*["'][^>]*>(.*?)<\/span>/gi, '[FONTSIZE:$1]$2[/FONTSIZE]');
  } while (text !== previousText);
  text = text.replace(/<u[^>]*>(.*?)<\/u>/gi, '[UNDERLINE]$1[/UNDERLINE]');
  text = text.replace(/<[^>]+>/g, "");
  do {
    previousText = text;
    text = text.replace(/\[FONTSIZE:([^\]]+)\](.*?)\[\/FONTSIZE\]/g, '<span style="font-size: $1">$2</span>');
  } while (text !== previousText);
  do {
    previousText = text;
    text = text.replace(/\[UNDERLINE\](.*?)\[\/UNDERLINE\]/g, '<u>$1</u>');
  } while (text !== previousText);
  do {
    previousText = text;
    text = text.replace(/\[ALIGN:([^\]]+)\](.*?)\[\/ALIGN\]/g, '<p style="text-align: $1">$2</p>');
  } while (text !== previousText);
  text = text.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  text = text.split("\n").map(line => line.trim() === "" ? "" : line).join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
};

const convertMarkdownToEditorHtml = (text: string): string => {
  if (!text) return "";
  const cleanText = text.replace(/```html/g, "").replace(/```/g, "").replace(/\t/g, " ").trim();
  const normalizedText = cleanText.replace(/\r\n/g, "\n");
  const lines = normalizedText.split("\n");
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
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: inherit; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: transparent;">&nbsp;</p>`;
    }
    const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed);
    const isTitle = idx === firstNonEmptyIdx && isFullyBold;
    if (isTitle) {
      const titleText = trimmed.replace(/^\*\*|\*\*$/g, "");
      const emptyLine = `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: inherit; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: transparent;">&nbsp;</p>`;
      const titleHtml = `<p align="center" style="text-align: center; font-family: Arial, sans-serif; font-size: 11pt; color: inherit; line-height: 1.15; margin: 0; padding: 0; background-color: transparent;"><u><strong>${titleText}</strong></u></p>`;
      return `${emptyLine}${titleHtml}`;
    } else if (isFullyBold) {
      const headerText = trimmed.replace(/^\*\*|\*\*$/g, "");
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: inherit; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: transparent;"><strong>${headerText}</strong></p>`;
    } else {
      let formattedLine = trimmed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      formattedLine = formattedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      return `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: inherit; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: transparent;">${formattedLine}</p>`;
    }
  });
  return `<div style="font-family: Arial, sans-serif; font-size: 11pt; color: inherit; background-color: transparent; line-height: 1.15; padding: 8px; text-align: left;">${htmlLines.join("")}</div>`;
};

export default function TemplatesPage() {
  const router = useRouter();
  // Resolver API_URL de forma dinámica en red local para evitar fallas al conectar desde otros dispositivos
  const API_URL = "/api";


  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [contentError, setContentError] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>("base");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeAiModel, setActiveAiModel] = useState<string>("gemma");
  const [userRole, setUserRole] = useState<string>("");

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
    if (theme) {
      if (theme.primary) root.style.setProperty("--clinical-bg", theme.primary);
      if (theme.secondary) {
        root.style.setProperty("--clinical-panel", theme.secondary);
        root.style.setProperty("--clinical-panel-light", `${theme.secondary}cc`);
      }
      if (theme.accent) {
        root.style.setProperty("--clinical-teal", theme.accent);
        root.style.setProperty("--clinical-teal-dim", `${theme.accent}cc`);
      }
    } else {
      root.style.removeProperty("--clinical-bg");
      root.style.removeProperty("--clinical-panel");
      root.style.removeProperty("--clinical-panel-light");
      root.style.removeProperty("--clinical-teal");
      root.style.removeProperty("--clinical-teal-dim");
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
  }, [isAuthenticated]);
  
  // Estados para búsqueda y filtrado
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDoctorId, setFilterDoctorId] = useState<string>("all");

  // Estados para previsualización y copiado
  const [previewTemplate, setPreviewTemplate] = useState<{ id: number; title: string; content: string; doctorName?: string | null } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copySuccessText, setCopySuccessText] = useState(false);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  


  const convertReportToClipboardHtml = (text: string): string => {
    if (!text) return "";

    const cleanText = text.replace(/```html/g, "").replace(/```/g, "").replace(/\t/g, " ").trim();
    const normalizedText = cleanText.replace(/\r\n/g, "\n");
    const paragraphs = normalizedText.split(/\n\s*\n/);

    const htmlParagraphs = paragraphs.map((para, idx) => {
      const trimmed = para.trim();
      if (!trimmed) return "";

      const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed);
      const isTitle = idx === 0 && isFullyBold;

      const baseStyle = "font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5; margin: 0 0 12pt 0; background-color: transparent;";

      if (isTitle) {
        const titleText = trimmed.replace(/^\*\*|\*\*$/g, "");
        const titleStyle = "font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #000000; line-height: 1.5; text-align: center; text-decoration: underline; margin: 0 0 16pt 0; background-color: transparent;";
        return `<p style="${titleStyle}"><b>${titleText}</b></p>`;
      } else if (isFullyBold) {
        const headerText = trimmed.replace(/^\*\*|\*\*$/g, "");
        const headerStyle = "font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5; margin: 12pt 0 4pt 0; background-color: transparent;";
        return `<p style="${headerStyle}"><b>${headerText}</b></p>`;
      } else {
        let formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
        formatted = formatted.replace(/\n/g, "<br>");
        return `<p style="${baseStyle}">${formatted}</p>`;
      }
    });

    const content = htmlParagraphs.filter(p => p !== "").join("\n");
    return `<b id="docs-internal-guid-clinical-report" style="font-weight:normal;">\n<div style="font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000000; background-color: #ffffff; padding: 12pt; line-height: 1.5;">\n${content}\n</div>\n</b>`;
  };

  const convertReportToHtml = (text: string): string => {
    if (!text) return "";

    const cleanText = text.replace(/```html/g, "").replace(/```/g, "").replace(/\t/g, " ").trim();
    const normalizedText = cleanText.replace(/\r\n/g, "\n");
    const paragraphs = normalizedText.split(/\n\s*\n/);

    const htmlParagraphs = paragraphs.map((para, idx) => {
      const trimmed = para.trim();
      if (!trimmed) return "";

      const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed);
      const isTitle = idx === 0 && isFullyBold;

      if (isTitle) {
        const titleText = trimmed.replace(/^\*\*|\*\*$/g, "");
        return `<p style="font-family: Arial, sans-serif; font-size: 12pt; text-decoration: underline; text-align: center; margin: 0 0 16px 0; line-height: 1.5; color: #000000; background-color: #ffffff;"><b>${titleText}</b></p>`;
      } else if (isFullyBold) {
        const headerText = trimmed.replace(/^\*\*|\*\*$/g, "");
        return `<p style="font-family: Arial, sans-serif; font-size: 11pt; margin: 12px 0 4px 0; line-height: 1.5; color: #000000; background-color: #ffffff;"><b>${headerText}</b></p>`;
      } else {
        let formattedPara = trimmed.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
        formattedPara = formattedPara.replace(/\n/g, "<br>");
        return `<p style="font-family: Arial, sans-serif; font-size: 11pt; margin: 0 0 8px 0; line-height: 1.5; color: #000000; background-color: #ffffff;">${formattedPara}</p>`;
      }
    });

    return `<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; background-color: #ffffff; line-height: 1.5; padding: 8px;">${htmlParagraphs.filter(p => p !== "").join("")}</div>`;
  };

  const handleCopyClipboard = async (text: string) => {
    if (!text) return;

    const clipboardHtml = convertReportToClipboardHtml(text);
    const plainText = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\t/g, " ");

    const copyViaEvent = (htmlContent: string, plainTextContent: string): boolean => {
      let success = false;
      const listener = (e: any) => {
        if (e.clipboardData) {
          e.clipboardData.setData("text/html", htmlContent);
          e.clipboardData.setData("text/plain", plainTextContent);
          e.preventDefault();
          success = true;
        }
      };

      document.addEventListener("copy", listener);

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
        console.error("Error al copiar:", err);
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
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([clipboardHtml], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        copyViaEvent(clipboardHtml, plainText);
      }
    } catch {
      try {
        copyViaEvent(clipboardHtml, plainText);
      } catch {}
    }

    setCopySuccessText(true);
    setTimeout(() => setCopySuccessText(false), 2000);
  };
  const handleOpenPreview = async (doc: DocumentItem) => {
    setIsFetchingPreview(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/documents/${doc.id}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("doctor_id");
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error("No se pudo obtener el contenido de la plantilla.");
      }
      const data = await res.json();
      setPreviewTemplate({
        id: doc.id,
        title: doc.title,
        content: data.content,
        doctorName: doc.doctorName
      });
      setIsPreviewOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar la plantilla.";
      setError(message);
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const handleQuickCopy = async (doc: DocumentItem) => {
    setIsFetchingPreview(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/documents/${doc.id}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("doctor_id");
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error("No se pudo obtener el contenido de la plantilla.");
      }
      const data = await res.json();
      await handleCopyClipboard(data.content);
      setSuccess(`Plantilla "${doc.title}" copiada al portapapeles.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al copiar la plantilla.";
      setError(message);
    } finally {
      setIsFetchingPreview(false);
    }
  };
  // Estados de carga e interfaz
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isServerOnline, setIsServerOnline] = useState(false);

  // Estados de Médicos
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [modalDoctorId, setModalDoctorId] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Estados de Edición y Carga de Archivos
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isFileParsing, setIsFileParsing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isEditorMaximized, setIsEditorMaximized] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const updateSourceRef = useRef<"direct" | "typing" | "history_nav">("direct");
  
  // Estados para historial de Deshacer/Rehacer
  const [templateHistory, setTemplateHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);
  const templateHistoryRef = useRef<string[]>([]);
  const saveHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados para Modales de Cancelar / Guardar (Modo Maximizado)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Sincronización de referencias para el historial
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    templateHistoryRef.current = templateHistory;
  }, [templateHistory]);

  // Agregar al historial
  const pushToHistoryStack = useCallback((newVal: string) => {
    setTemplateHistory(prev => {
      const currentIndex = historyIndexRef.current;
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newVal);
      // Limitar a 50 estados para no saturar memoria
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex > 49 ? 49 : nextIndex;
    });
  }, []);

  const handleUndo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = templateHistoryRef.current;
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setHistoryIndex(prevIndex);
      const prevContent = currentHistory[prevIndex];
      updateSourceRef.current = "history_nav";
      setContent(prevContent);
    }
  }, []);

  const handleRedo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = templateHistoryRef.current;
    if (currentIndex < currentHistory.length - 1) {
      const nextIndex = currentIndex + 1;
      setHistoryIndex(nextIndex);
      const nextContent = currentHistory[nextIndex];
      updateSourceRef.current = "history_nav";
      setContent(nextContent);
    }
  }, []);

  // Atajos de teclado para Ctrl+Z y Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo actuar si el editor está en foco o maximizado
      if (!isEditorMaximized && document.activeElement !== editorRef.current) return;
      
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
  }, [handleUndo, handleRedo, isEditorMaximized]);

  // Cuando cambia el contenido de "content" o entra al editor
  useEffect(() => {
    if (editorRef.current) {
      if (updateSourceRef.current === "typing") {
        updateSourceRef.current = "direct";
        return;
      }

      const html = convertMarkdownToEditorHtml(content);
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = sanitizeHtml(html);
      }
      
      if (updateSourceRef.current === "history_nav") {
        updateSourceRef.current = "direct";
        return;
      }

      // Guardado en el historial para cambios externos o carga inicial
      if (saveHistoryTimeoutRef.current) {
        clearTimeout(saveHistoryTimeoutRef.current);
      }
      pushToHistoryStack(content);

    }
  }, [content, isEditMode, isEditorMaximized, pushToHistoryStack]);

  const handleEditorInput = () => {
    if (editorRef.current) {
      updateSourceRef.current = "typing";
      const html = editorRef.current.innerHTML;
      const markdown = convertHtmlToMarkdown(html);
      setContent(markdown);
      if (contentError && markdown.trim()) {
        setContentError(false);
      }

      // Debounce para guardar en el historial (1 segundo sin escribir)
      if (saveHistoryTimeoutRef.current) {
        clearTimeout(saveHistoryTimeoutRef.current);
      }
      saveHistoryTimeoutRef.current = setTimeout(() => {
        pushToHistoryStack(markdown);
      }, 1000);
    }
  };

  // Estados del Modal de Confirmación de Eliminación
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState("");




  const fetchDocuments = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/documents`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        throw new Error("No se pudo obtener la lista de plantillas.");
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar la base de conocimientos RAG.");
    }
  }, [API_URL, router]);

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
        setActiveAiModel(data.activeAiModel);
      }
    } catch (err) {
      console.error("Error al cargar configuración de IA:", err);
    }
  }, [API_URL]);

  const handleAiModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActiveAiModel(val);
    try {
      await fetch(`${API_URL}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeAiModel: val }),
      });
    } catch (err) {
      console.error("Error al guardar configuración de IA:", err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
    const role = localStorage.getItem("role");
    if (!token) {
      router.push("/login");
      return;
    }
    if (role !== "admin" && role !== "doctor" && role !== "moderator") {
      router.push("/");
      return;
    }
    setIsAuthenticated(true);
    setIsAdmin(role === "admin");
    setUserRole(role || "");

    if (role === "doctor") {
      const docId = localStorage.getItem("doctor_id");
      if (docId) {
        const parsed = parseInt(docId);
        setModalDoctorId(parsed);
        setFilterDoctorId(docId);
      }
    }

    const timer = setTimeout(() => {
      fetchDocuments();
      fetchDoctors();
      fetchSettings();
      if (role === "admin") {
        fetchCompanies();
      }

      // Health check del backend
      const checkHealth = async () => {
        try {
          const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
          setIsServerOnline(res.ok);
        } catch {
          setIsServerOnline(false);
        }
      };
      checkHealth();
      const healthInterval = setInterval(checkHealth, 30000);
      return () => clearInterval(healthInterval);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDocuments, fetchDoctors, API_URL, router]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalDoctorId = modalDoctorId;
    const role = typeof window !== "undefined" ? localStorage.getItem("role") : null;
    if (role === "doctor") {
      const docId = typeof window !== "undefined" ? localStorage.getItem("doctor_id") : null;
      if (docId) finalDoctorId = parseInt(docId);
    }

    if (!finalDoctorId) {
      setError("Debe asociar un médico a la plantilla.");
      return;
    }

    if (!isEditMode) {
      if (selectedFiles.length === 0) {
        setError("Debe cargar al menos un archivo de plantilla.");
        return;
      }
      await processSelectedFiles(selectedFiles, finalDoctorId);
      return;
    }

    const isTitleEmpty = !title.trim();
    const isContentEmpty = !content.trim();

    setTitleError(isTitleEmpty);
    setContentError(isContentEmpty);

    if (isTitleEmpty || isContentEmpty) {
      setError("El título y el contenido son campos requeridos.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const url = `${API_URL}/api/documents/${editId}`;
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");

      const res = await fetch(url, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title, content, doctorId: finalDoctorId }),
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fallo al procesar la plantilla.");
      }

      setSuccess("Plantilla actualizada y re-vectorizada exitosamente.");
      setTitle("");
      setContent("");
      setTitleError(false);
      setContentError(false);
      setModalDoctorId(null);
      setIsEditMode(false);
      setEditId(null);
      setSelectedFiles([]);
      setIsModalOpen(false);
      fetchDocuments();
    } finally {
      setIsLoading(false);
    }
  };

  const processSelectedFiles = async (files: File[], finalDoctorId: number) => {
    if (files.length === 0) return;

    if (files.length > 100) {
      setError("No se pueden cargar más de 100 archivos simultáneamente.");
      return;
    }

    setIsFileParsing(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      formData.append("doctorId", finalDoctorId.toString());

      const res = await fetch(`${API_URL}/api/documents/ingest-multiple`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al ingestar archivos.");
      }

      const data = await res.json();
      
      interface BatchResultItem {
        fileName: string;
        status: 'success' | 'error';
        error?: string;
      }
      const successes = data.results.filter((r: BatchResultItem) => r.status === "success");
      const failures = data.results.filter((r: BatchResultItem) => r.status === "error");
      if (failures.length > 0) {
        const failedFileNames = new Set(failures.map((f: BatchResultItem) => f.fileName.toLowerCase().trim()));
        const newSelectedFiles = selectedFiles.filter(file => failedFileNames.has(file.name.toLowerCase().trim()));
        setSelectedFiles(newSelectedFiles);

        setError(
          `Lote completado con advertencias (${successes.length} éxitos, ${failures.length} errores). Se mantuvieron en la lista los archivos fallidos. Detalle de errores:\n` +
            failures.map((f: BatchResultItem) => `• ${f.fileName}: ${f.error}`).join("\n")
        );
        
        if (successes.length > 0) {
          setSuccess(`Se guardaron exitosamente ${successes.length} plantillas.`);
        } else {
          setSuccess(null);
        }
      } else {
        setSuccess(`¡Ingesta exitosa! Se procesaron y vectorizaron ${successes.length} plantillas correctamente.`);
        setSelectedFiles([]);
        setError(null);
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccess(null);
        }, 1500);
      }

      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Error al procesar archivos.");
    } finally {
      setIsFileParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleEdit = async (doc: DocumentItem) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/documents/${doc.id}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error("No se pudo obtener los detalles de la plantilla.");
      }
      const data = await res.json();
      setTitle(data.title);
      setContent(data.content);
      setModalDoctorId(data.doctorId || null);
      setIsEditMode(true);
      setEditId(doc.id);
      setTitleError(false);
      setContentError(false);
      setSelectedFiles([]);
      setIsModalOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar plantilla.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setTitle("");
    setContent("");
    setModalDoctorId(null);
    setSelectedFiles([]);
    setIsEditMode(false);
    setEditId(null);
    setError(null);
    setSuccess(null);
    setTitleError(false);
    setContentError(false);
    setIsModalOpen(false);
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
    router.push("/login");
  };

  const handleDeleteClick = (doc: DocumentItem) => {
    setDeleteTargetId(doc.id);
    setDeleteTargetTitle(doc.title);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return;
    setIsDeleteModalOpen(false);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/documents/${deleteTargetId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (res.ok) {
        setSuccess("Plantilla eliminada exitosamente.");
        fetchDocuments();
      } else {
        throw new Error("No se pudo eliminar el documento.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar plantilla.";
      setError(message);
    } finally {
      setDeleteTargetId(null);
      setDeleteTargetTitle("");
    }
  };

  // Plantillas de demostración clínica precargables
  const loadDemoTemplate = (type: "eco" | "rx" | "rm") => {
    if (type === "eco") {
      setTitle("Plantilla Ecografía Abdominal");
      setContent(`INFORME DE ECOGRAFÍA ABDOMINAL
Hígado: de forma, tamaño y contornos normales. Parénquima homogéneo con ecogenicidad conservada. No se observan lesiones focales ni signos de esteatosis.
Vesícula Biliar: de volumen normal, paredes finas y regulares (menor a 3mm). No se observan cálculos ni barro biliar en su interior.
Vías Biliares: intra y extrahepática de calibre normal. Colédoco no dilatado.
Páncreas: de tamaño, contornos y ecoestructura conservados. Conducto de Wirsung no visible.
Bazo: de tamaño y características ecográficas normales.
Riñones: de tamaño normal, con buena relación cortico-medular. No se observan ectasias pielocaliciales, imágenes litiásicas ni masas sólidas.
Aorta Abdominal: de calibre y trayecto normales.
Vejiga: de paredes lisas, libre de contenido patológico.`);
    } else if (type === "rx") {
      setTitle("Plantilla Radiografía de Tórax Frente");
      setContent(`INFORME DE RADIOGRAFÍA DE TÓRAX
Campos Pulmonares: con buena expansión y aireación. Parénquima pulmonar homogéneo, libre de infiltrados alveolares o intersticiales activos. No se observan imágenes compatibles con nódulos, masas ni consolidaciones neumónicas.
Silueta Cardíaca: de configuración y tamaño normales. Índice cardiotorácico conservado. Grandes vasos y mediastino de características radiológicas normales.
Pleura y Espacio Pleural: senos costofrénicos y cardiofrénicos libres, bien perfilados. No hay signos de derrame pleural ni neumotórax.
Estructuras Óseas y Blandas: caja torácica ósea (arcos costales, clavículas, columna dorsal) y partes blandas de aspecto normal.`);
    } else if (type === "rm") {
      setTitle("Plantilla Resonancia Rodilla");
      setContent(`INFORME DE RESONANCIA MAGNÉTICA DE RODILLA
Menisco Medial / Interno: de morfología y señal conservadas. Cuernos anterior y posterior libres de fisuras o desgarros.
Menisco Lateral / Externo: morfología normal, señal homogénea. No se identifican trazos de ruptura.
Ligamentos Cruzados: ligamento cruzado anterior (LCA) y ligamento cruzado posterior (LCP) de trayecto, espesor y señal normales, sin signos de discontinuidad o ruptura.
Ligamentos Colaterales: colateral interno (MCL) y colateral externo (LCL) de características anatómicas y señal conservadas.
Tendones: rotuliano y cuadricipital de inserción, calibre y señal normales.
Estructuras Óseas: superficies articulares congruentes. No se observan focos de edema óseo subcondral, osteocondritis disecante ni fracturas trabeculares.
Espacio Articular: cantidad normal de líquido sinovial. Sin evidencia de derrame articular ni quiste de Baker.`);
    }
  };

  // Filtrar documentos del lado del cliente
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDoctor =
      filterDoctorId === "all" ||
      (filterDoctorId === "general" && doc.doctorId === null) ||
      (doc.doctorId !== null && doc.doctorId.toString() === filterDoctorId);

    return matchesSearch && matchesDoctor;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
          <span className="text-xs text-clinical-text-muted font-semibold tracking-wide">Cargando panel de administración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-clinical-bg text-clinical-text font-sans">
      
      {/* Sidebar de Navegación Lateral */}
      <aside className="w-16 lg:w-64 bg-clinical-panel border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-300">
        <div>
          <div className="h-16 px-4 lg:px-6 border-b border-slate-800 flex items-center justify-center">
            {companyName && companyName.toLowerCase() === "sistema" ? (
              <>
                <span className="text-lg font-extrabold tracking-widest text-clinical-teal uppercase select-none hidden lg:block">
                  Sistema
                </span>
                <span className="text-sm font-extrabold text-clinical-teal uppercase select-none block lg:hidden">
                  SYS
                </span>
              </>
            ) : companyLogo ? (
              <img src={companyLogo} alt={companyName || "Empresa"} className="h-10 w-auto object-contain" />
            ) : companyName && companyName.toLowerCase() === "imagen diagnóstica" ? (
              <>
                <img src="/logoIDblanco.png" alt="Imagen Diagnóstica" className="h-10 w-auto object-contain hidden lg:block" />
                <span className="text-base font-extrabold text-clinical-teal block lg:hidden">ID</span>
              </>
            ) : companyName ? (
              <>
                <span className="text-md font-bold tracking-wider text-clinical-teal uppercase select-none truncate max-w-full px-2 hidden lg:block" title={companyName}>
                  {companyName}
                </span>
                <span className="text-sm font-bold text-clinical-teal uppercase select-none block lg:hidden">
                  {companyName.substring(0, 3).toUpperCase()}
                </span>
              </>
            ) : (
              <>
                <img src="/logoIDblanco.png" alt="Imagen Diagnóstica" className="h-10 w-auto object-contain hidden lg:block" />
                <span className="text-base font-extrabold text-clinical-teal block lg:hidden">ID</span>
              </>
            )}
          </div>

          <nav className="p-2 lg:p-4 space-y-1">
            {userRole !== "moderator" && (
              <>
                <Link
                  href="/"
                  className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold text-clinical-text-muted hover:bg-slate-800/50 hover:text-clinical-text transition-all"
                  title="Dictador de Voz"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                  <span className="hidden lg:inline">Dictador de Voz</span>
                </Link>

                <Link
                  href="/historial"
                  className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold text-clinical-text-muted hover:bg-slate-800/50 hover:text-clinical-text transition-all"
                  title="Historial de Informes"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664v.75h6V4.5c0-.231.035-.454.1-.664M11.25 1.5a2.25 2.25 0 0 0-2.25 2.25v15.75a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25V3.75a2.25 2.25 0 0 0-2.25-2.25h-7.5Z" />
                  </svg>
                  <span className="hidden lg:inline">Historial de Informes</span>
                </Link>
              </>
            )}

            {(isAdmin || (typeof window !== "undefined" && (localStorage.getItem("role") === "doctor" || localStorage.getItem("role") === "moderator"))) && (
              <Link
                href="/templates"
                className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold bg-clinical-teal/10 text-clinical-teal border border-clinical-teal/20 transition-all"
                title="Plantillas RAG"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="hidden lg:inline">Plantillas RAG</span>
              </Link>
            )}

            {(isAdmin || (typeof window !== "undefined" && localStorage.getItem("role") === "moderator")) && (
              <>
                <Link
                  href="/doctors"
                  className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold text-clinical-text-muted hover:bg-slate-800/50 hover:text-clinical-text transition-all"
                  title="Médicos"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <span className="hidden lg:inline">Médicos</span>
                </Link>
                {isAdmin && (
                  <Link
                    href="/moderators"
                    className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold text-clinical-text-muted hover:bg-slate-800/50 hover:text-clinical-text transition-all"
                    title="Moderadores"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                    </svg>
                    <span className="hidden lg:inline">Moderadores</span>
                  </Link>
                )}
                <Link
                  href="/companies"
                  className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold text-clinical-text-muted hover:bg-slate-800/50 hover:text-clinical-text transition-all"
                  title="Empresas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h18v18H3V3Z" />
                  </svg>
                  <span className="hidden lg:inline">Empresas</span>
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Botón de Logout */}
        <div className="border-t border-slate-800 flex flex-col shrink-0">
          <div className="p-2 lg:p-4">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full px-2 py-2.5 lg:px-4 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-950/20 border border-rose-900/30 transition-all cursor-pointer"
              title={`Cerrar Sesión ${isAdmin ? "Admin" : ""}`}
            >
              <span>🔒</span>
              <span className="hidden lg:inline">Cerrar Sesión {isAdmin ? "Admin" : ""}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Workspace de Trabajo Principal */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
        
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-clinical-panel shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide text-clinical-text">Base de Conocimientos</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-clinical-teal/15 text-clinical-teal border border-clinical-teal/30">
              {filteredDocuments.length} {filteredDocuments.length === 1 ? "plantilla" : "plantillas"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Selector de Vista Previa de Empresa (Solo Admin) */}
            {isAdmin && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-clinical-text-muted font-semibold">Vista Previa:</span>
                <select
                  value={selectedPreviewCompanyId}
                  onChange={handlePreviewCompanyChange}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-clinical-text font-semibold focus:outline-none focus:border-clinical-teal cursor-pointer"
                >
                  <option value="base">Sistema (Base)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Selector de Conexión IA */}
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs text-clinical-text-muted font-semibold">Conexión IA:</span>
              <select
                value={activeAiModel}
                onChange={handleAiModelChange}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-clinical-text font-semibold focus:outline-none focus:border-clinical-teal cursor-pointer"
              >
                <option value="gemma">Gemma (Local)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1</option>
                <option value="groq-llama-3.1-8b-instant">Groq Llama 3.1 8B</option>
              </select>
            </div>

            {/* Botón Ingestar Plantilla */}
            <button
              onClick={() => {
                setTitle("");
                setContent("");
                setSelectedFiles([]);
                const role = localStorage.getItem("role");
                if (role === "doctor") {
                  const docId = localStorage.getItem("doctor_id");
                  if (docId) {
                    setModalDoctorId(parseInt(docId));
                  } else {
                    setModalDoctorId(null);
                  }
                } else {
                  setModalDoctorId(null);
                }
                setIsEditMode(false);
                setEditId(null);
                setTitleError(false);
                setContentError(false);
                setError(null);
                setSuccess(null);
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold text-xs transition-all shadow-md shadow-clinical-teal/10 cursor-pointer animate-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Ingestar Plantilla</span>
            </button>

          </div>

        </header>

        {/* Zona del Tablero Principal */}
        <section className="flex-1 p-4 lg:p-6 overflow-y-auto min-h-0">


          {/* Listado de Plantillas */}
          <div className="bg-clinical-panel border border-slate-800 rounded-2xl p-6 shadow-lg relative min-h-full">
            
            {/* Overlay de carga al buscar/copiar contenido de plantilla */}
            {isFetchingPreview && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs rounded-2xl flex items-center justify-center z-20">
                <div className="flex items-center gap-2 text-xs font-bold text-clinical-teal bg-clinical-panel border border-slate-800 px-3 py-2 rounded-xl shadow-lg">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-clinical-teal border-t-transparent animate-spin"></span>
                  <span>Cargando contenido de plantilla...</span>
                </div>
              </div>
            )}

            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-clinical-text">Plantillas Vectorizadas</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-clinical-teal/10 text-clinical-teal border border-clinical-teal/20">
                    {filteredDocuments.length} {filteredDocuments.length === 1 ? "plantilla" : "plantillas"}
                  </span>
                </div>
                <p className="text-xs text-clinical-text-muted mt-1">Listado de conocimientos vectorizados disponibles para consulta semántica</p>
              </div>

              {/* Barra de Búsqueda y Filtros */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-[480px]">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar plantilla por título..."
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9.5 pr-8 py-2 text-xs focus:outline-none focus:border-clinical-teal text-clinical-text font-medium transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-clinical-text transition-all cursor-pointer animate-none"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {userRole !== "doctor" && (
                  <div className="w-full sm:w-52">
                    <select
                      value={filterDoctorId}
                      onChange={(e) => setFilterDoctorId(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-clinical-teal text-clinical-text font-medium cursor-pointer transition-all"
                    >
                      <option value="all" className="bg-slate-900 text-clinical-text">Todos los Médicos</option>
                      <option value="general" className="bg-slate-900 text-clinical-text">Generales / Sin Médico</option>
                      {doctors.map((doc) => (
                        <option key={doc.id} value={doc.id.toString()} className="bg-slate-900 text-clinical-text">
                          {doc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredDocuments.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center text-center p-12 text-clinical-text-muted h-full">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm text-clinical-text">No se encontraron plantillas</h3>
                  <p className="text-xs max-w-xs mt-2 leading-relaxed">
                    Ajuste los criterios de búsqueda o use el botón superior para ingestar una nueva plantilla.
                  </p>
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-5 bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-black/25 relative group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-8 h-8 rounded-xl bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center text-clinical-teal text-sm shrink-0">
                            📄
                          </span>
                          <h4 className="text-sm font-bold truncate text-clinical-text group-hover:text-clinical-teal transition-colors" title={doc.title}>{doc.title}</h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-clinical-text-muted mt-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-clinical-text font-semibold">
                          {doc.length} caracteres
                        </span>
                        <span className="px-2 py-0.5 rounded bg-clinical-teal/10 border border-clinical-teal/20 text-clinical-teal font-semibold">
                          👨‍⚕️ {doc.doctorName || "General / Compartido"}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800/40 text-clinical-text-muted">
                          Ingreso: {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 mt-5 pt-3 border-t border-slate-800/50">
                      <button
                        onClick={() => handleOpenPreview(doc)}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-clinical-teal/15 text-slate-500 hover:text-clinical-teal border border-slate-800 hover:border-clinical-teal/30 transition-all cursor-pointer animate-none"
                        title="Previsualizar plantilla"
                        aria-label="Previsualizar plantilla"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleQuickCopy(doc)}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-clinical-teal/15 text-slate-500 hover:text-clinical-teal border border-slate-800 hover:border-clinical-teal/30 transition-all cursor-pointer animate-none"
                        title="Copiar contenido"
                        aria-label="Copiar contenido de la plantilla"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {(isAdmin ||
                        (typeof window !== "undefined" && localStorage.getItem("role") === "moderator") ||
                        (typeof window !== "undefined" &&
                          localStorage.getItem("role") === "doctor" &&
                          doc.doctorId !== null &&
                          doc.doctorId.toString() === localStorage.getItem("doctor_id"))
                      ) && (
                        <>
                          <button
                            onClick={() => handleEdit(doc)}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-clinical-teal/15 text-slate-500 hover:text-clinical-teal border border-slate-800 hover:border-clinical-teal/30 transition-all cursor-pointer animate-none"
                            title="Editar plantilla"
                            aria-label="Editar plantilla"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(doc)}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 transition-all cursor-pointer animate-none"
                            title="Eliminar plantilla"
                            aria-label="Eliminar plantilla"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Formulario de Registro / Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-clinical-panel border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col min-h-0 animate-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 shrink-0">
              <div>
                <h2 className="text-md font-bold tracking-wide uppercase text-clinical-teal">
                  {isEditMode ? "Modificar Plantilla" : "Ingestar Plantilla"}
                </h2>
                <p className="text-[10px] text-clinical-text-muted mt-0.5">
                  Vectorice plantillas de estudio para alimentar el contexto RAG
                </p>
              </div>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-clinical-text transition-all cursor-pointer animate-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleIngest} className="flex-1 flex flex-col space-y-4">
              
              {/* Box de carga de archivos en modal */}
              {!isEditMode && (
                <>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`p-4 rounded-xl border border-dashed transition-all flex flex-col items-center justify-center text-center relative group min-h-[90px] ${
                      isDragging
                        ? "border-clinical-teal bg-clinical-teal/10 shadow-lg shadow-clinical-teal/5"
                        : "border-slate-800 bg-slate-950/20 hover:bg-slate-900/30"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".docx,.pdf,.txt,.doc,.rtf"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      disabled={isFileParsing}
                      multiple
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-clinical-teal mb-1.5 group-hover:scale-105 transition-all">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                    {isFileParsing ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-clinical-teal">
                        <span className="w-3.5 h-3.5 rounded-full border border-clinical-teal border-t-transparent animate-spin"></span>
                        <span>Procesando lote de archivos...</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-clinical-text">
                          {isDragging ? "¡Suelte los archivos aquí!" : "Cargar plantilla(s) desde archivos"}
                        </span>
                        <span className="text-[9px] text-clinical-text-muted mt-0.5">Soporta uno o varios archivos Word, RTF, PDF o Texto</span>
                      </>
                    )}
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-teal">
                          Archivos seleccionados ({selectedFiles.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles([])}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-all cursor-pointer animate-none"
                        >
                          Limpiar todos
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-clinical-text bg-slate-900/40 border border-slate-800/40 px-2.5 py-1.5 rounded-lg">
                            <span className="truncate max-w-[70%]">📄 {file.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-clinical-text-muted">({(file.size / 1024).toFixed(1)} KB)</span>
                              <button
                                type="button"
                                onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="text-rose-400 hover:text-rose-300 font-bold px-1 cursor-pointer text-xs"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {isEditMode && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                    Título de la plantilla / guía <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (titleError && e.target.value.trim()) {
                        setTitleError(false);
                      }
                    }}
                    placeholder="Ej: Ecografía Abdominal Normal"
                    className={`w-full bg-slate-950/40 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold text-clinical-text ${
                      titleError
                        ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                        : "border-slate-800 focus:border-clinical-teal"
                    }`}
                  />
                </div>
              )}

              {(isAdmin || (typeof window !== "undefined" && localStorage.getItem("role") === "moderator")) ? (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                    Asociar Médico <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
                  </label>
                  <select
                    value={modalDoctorId || ""}
                    onChange={(e) => setModalDoctorId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold cursor-pointer text-clinical-text"
                  >
                    <option value="" disabled>-- Seleccione un Médico (Requerido) --</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id} className="bg-slate-900 text-clinical-text">
                        {doc.name} ({doc.specialty})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                    Asociar Médico
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== "undefined" ? (localStorage.getItem("doctor_name") || "Médico") : "Médico"}
                    className="w-full bg-slate-950/20 border border-slate-800/50 rounded-xl px-3 py-2 text-xs font-semibold text-clinical-text-muted cursor-not-allowed focus:outline-none"
                  />
                </div>
              )}

              {isEditMode && (
                <div className={isEditorMaximized ? "fixed inset-4 md:inset-10 z-50 bg-clinical-panel border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col" : "flex flex-col"}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted">
                      Contenido de texto estructurado <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsEditorMaximized(!isEditorMaximized)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-clinical-text transition-colors flex items-center justify-center cursor-pointer"
                      title={isEditorMaximized ? "Restaurar tamaño" : "Maximizar editor"}
                      aria-label={isEditorMaximized ? "Restaurar tamaño" : "Maximizar editor"}
                    >
                      {isEditorMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <div className={`flex flex-col border rounded-xl overflow-hidden transition-all ${
                      contentError ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-800 focus-within:border-clinical-teal"
                    } ${isEditorMaximized ? "flex-1" : ""}`}
                  >
                    {/* Barra de herramientas */}
                    <div className="flex items-center gap-1.5 p-2 bg-slate-900 border-b border-slate-800 shrink-0 select-none overflow-x-auto">
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Deshacer (Ctrl+Z)"
                        aria-label="Deshacer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleRedo}
                        disabled={historyIndex >= templateHistory.length - 1}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Rehacer (Ctrl+Y)"
                        aria-label="Rehacer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                        </svg>
                      </button>
                      <span className="w-[1px] h-5 bg-slate-800 mx-1 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { document.execCommand('bold', false); handleEditorInput(); }}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                        title="Negrita"
                        aria-label="Formato negrita"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h4.5a3.75 3.75 0 0 1 0 7.5h-4.5m0-7.5v7.5m0-7.5h3.75M6.75 11.25h6a3.75 3.75 0 0 1 0 7.5h-6m0-7.5v7.5m0-7.5h3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { document.execCommand('italic', false); handleEditorInput(); }}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                        title="Cursiva"
                        aria-label="Formato cursiva"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 4.5l-4 15m-1.5-15h4m-6 15h4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { document.execCommand('underline', false); handleEditorInput(); }}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                        title="Subrayado"
                        aria-label="Formato subrayado"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16" />
                        </svg>
                      </button>
                      <span className="w-[1px] h-5 bg-slate-800 mx-1 shrink-0" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { document.execCommand('justifyLeft', false); handleEditorInput(); }}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                        title="Alinear Izquierda"
                        aria-label="Alinear a la izquierda"
                      ><AlignLeft className="w-4 h-4" /></button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { document.execCommand('justifyCenter', false); handleEditorInput(); }}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                        title="Centrar"
                        aria-label="Centrar texto"
                      ><AlignCenter className="w-4 h-4" /></button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { document.execCommand('justifyRight', false); handleEditorInput(); }}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                        title="Alinear Derecha"
                        aria-label="Alinear a la derecha"
                      ><AlignRight className="w-4 h-4" /></button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { document.execCommand('justifyFull', false); handleEditorInput(); }}
                        className="p-1.5 rounded hover:bg-slate-800 text-clinical-text hover:text-clinical-teal transition-all cursor-pointer"
                        title="Justificar"
                        aria-label="Justificar texto"
                      ><AlignJustify className="w-4 h-4" /></button>
                    </div>
                    
                    {/* Área Editable */}
                    <div
                      ref={editorRef}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onInput={handleEditorInput}
                      className={`w-full bg-slate-950/40 p-4 text-xs resize-none focus:outline-none transition-all font-medium leading-relaxed overflow-y-auto text-clinical-text cursor-text ${
                        isEditorMaximized ? "flex-1 min-h-[300px]" : "min-h-[150px] max-h-[250px]"
                      }`}
                      style={{ outline: "none" }}
                    ></div>
                  </div>
                  
                  {isEditorMaximized && (
                     <div className="mt-4 flex justify-end gap-3">
                       <button
                         type="button"
                         onClick={() => setIsCancelModalOpen(true)}
                         className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-clinical-text font-semibold tracking-wide transition-all shadow-md text-xs cursor-pointer"
                       >
                         Cancelar
                       </button>
                       <button
                         type="button"
                         onClick={() => setIsSaveModalOpen(true)}
                         className="px-4 py-2 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md text-xs cursor-pointer"
                       >
                         Guardar
                       </button>
                     </div>
                  )}

                  {/* Modal de confirmación: Cancelar */}
                  {isCancelModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                      <div className="bg-clinical-panel border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-sm font-bold text-clinical-text mb-2">Cerrar editor</h3>
                        <p className="text-xs text-clinical-text-muted mb-6 leading-relaxed">
                          ¿Estás seguro de que deseas cancelar y cerrar el editor? Los cambios actuales no se perderán pero volverás a la vista normal.
                        </p>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setIsCancelModalOpen(false)}
                            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-clinical-text text-xs font-semibold transition-all cursor-pointer"
                          >
                            Volver al editor
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCancelModalOpen(false);
                              setIsEditorMaximized(false);
                            }}
                            className="px-4 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50 text-xs font-semibold transition-all cursor-pointer"
                          >
                            Sí, cerrar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modal de confirmación: Guardar */}
                  {isSaveModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                      <div className="bg-clinical-panel border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-sm font-bold text-clinical-text mb-2">Guardar cambios</h3>
                        <p className="text-xs text-clinical-text-muted mb-6 leading-relaxed">
                          ¿Deseas confirmar los cambios realizados y cerrar el editor maximizado?
                        </p>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setIsSaveModalOpen(false)}
                            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-clinical-text text-xs font-semibold transition-all cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSaveModalOpen(false);
                              setIsEditorMaximized(false);
                            }}
                            className="px-4 py-2 rounded-lg bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 text-xs font-bold transition-all cursor-pointer"
                          >
                            Sí, guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mensajes informativos de respuesta */}
              {error && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 font-medium animate-none">
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 font-medium animate-none">
                  ✅ {success}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-clinical-text font-bold tracking-wide transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer text-xs animate-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    (isEditMode
                      ? (!title.trim() || !content.trim() || !modalDoctorId)
                      : (selectedFiles.length === 0 || !modalDoctorId)
                    )
                  }
                  className="flex-1 py-2 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs animate-none"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                  ) : (
                    <span>Guardar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Confirmación de Eliminación Estilizado */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Confirmar Eliminación"
        message={`¿Está seguro de eliminar la plantilla de referencia "${deleteTargetTitle}"? La IA ya no la usará como contexto.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
      {/* Modal de Previsualización de Plantilla */}
      {isPreviewOpen && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-clinical-panel border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/20">
              <div>
                <h3 className="font-bold text-base text-clinical-text tracking-wide">
                  Previsualización: {previewTemplate.title}
                </h3>
                <p className="text-[10px] text-clinical-text-muted mt-0.5">
                  Médico Asociado: {previewTemplate.doctorName || "General / Todos"}
                </p>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Visor de Hoja Estructurada */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-teal">Estructura Base de la Plantilla</span>
                <div
                  className="report-paper p-8 overflow-y-auto max-h-[450px] outline-none select-text cursor-text border border-slate-200"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(convertReportToHtml(previewTemplate.content)) }}
                ></div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-end shrink-0 bg-slate-950/20 gap-3">
              <button
                onClick={() => handleCopyClipboard(previewTemplate.content)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-clinical-text transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.251 2.25 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h10.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6.75A1.5 1.5 0 0 1 5.25 21V9A1.5 1.5 0 0 1 6.75 7.5Z" />
                </svg>
                {copySuccessText ? "¡Copiado!" : "Copiar Contenido"}
              </button>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-clinical-text hover:bg-slate-800 transition-all cursor-pointer animate-none"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

