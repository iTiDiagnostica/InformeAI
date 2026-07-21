"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, RefreshCw, Calendar, ChevronDown, ChevronLeft, ChevronRight, 
  X, LayoutTemplate, Eye, ArrowUpRight, Copy, AlertCircle, Check 
} from "lucide-react";

import { Company, Doctor, Report, PaginationMetadata } from "@/types";
import { sanitizeHtml } from "@/utils/sanitize";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { applyTheme } from "@/utils/theme";

export default function HistorialPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Advanced search & filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  
  // Custom Date Range Calendar Picker states
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = React.useRef<HTMLDivElement>(null);

  // Detalle del modal
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Estados de admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>("base");

  // Resolver API_URL dinámicamente
  const API_URL = "";

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
  }, [isAdmin]);

  const fetchReports = useCallback(async (
    pageParam: number = 1,
    search: string = "",
    docId: string = "all",
    start: string = "",
    end: string = ""
  ) => {
    const page = isNaN(Number(pageParam)) ? 1 : Math.max(1, Number(pageParam));
    setIsLoading(true);
    setError(null);
    try {
      let queryStr = `${API_URL}/api/reports?page=${page}&limit=10`;
      if (search) queryStr += `&search=${encodeURIComponent(search)}`;
      if (docId !== "all") queryStr += `&doctorId=${docId}`;
      if (start) queryStr += `&startDate=${start}`;
      if (end) queryStr += `&endDate=${end}`;

      const headers: HeadersInit = {};
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch(queryStr, { headers });
      if (res.ok) {
        const data = await res.json();
        
        // Mapear snake_case del backend a camelCase del frontend
        interface DbReportRow {
          id: number;
          raw_text: string;
          structured_text: string;
          created_at: string;
          doctorId: number | null;
          doctorName: string | null;
          doctorSpecialty: string | null;
          reportType: string;
          createdByRole: string;
          aiType: string;
        }

        const mapped: Report[] = data.reports.map((row: DbReportRow) => ({
          id: row.id,
          rawText: row.raw_text,
          structuredText: row.structured_text,
          createdAt: row.created_at,
          doctorId: row.doctorId,
          doctorName: row.doctorName,
          doctorSpecialty: row.doctorSpecialty,
          reportType: row.reportType || "Informe",
          createdByRole: row.createdByRole || "Invitado",
          aiType: row.aiType || "Gemini"
        }));

        setReports(mapped);
        setPagination({
          page: data.pagination.page || data.pagination.currentPage || 1,
          limit: data.pagination.limit || 10,
          totalItems: data.pagination.totalItems || 0,
          totalPages: data.pagination.totalPages || 1
        });
      } else {
        throw new Error("No se pudo recuperar el historial.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
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

  // Debounce search input to avoid rapid requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load initial doctors & check auth
  useEffect(() => {
    if (typeof window === "undefined") return;
    
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

    if (role !== "admin" && role !== "doctor") {
      router.push("/");
      return;
    }

    if (role === "admin") {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
      if (role === "doctor") {
        // Si es un médico, forzar el filtro por su ID
        const docId = localStorage.getItem("doctor_id");
        if (docId) {
          setSelectedDoctorId(docId);
        }
      }
    }

    setIsAuthenticated(true);
    fetchDoctors();
    if (role === "admin") {
      fetchCompanies();
    }
  }, [fetchDoctors, router]);

  // Trigger reactive fetch on filter changes
  useEffect(() => {
    fetchReports(1, debouncedSearch, selectedDoctorId, startDate, endDate);
  }, [debouncedSearch, selectedDoctorId, startDate, endDate, fetchReports]);

  // Handle click outside to close custom calendar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const MONTHS_SPANISH = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateForBackend = (date: Date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(calendarYear, calendarMonth, day);
    const formatted = formatDateForBackend(clickedDate);

    if (!startDate || (startDate && endDate)) {
      setStartDate(formatted);
      setEndDate("");
    } else {
      if (new Date(startDate) > clickedDate) {
        setEndDate(startDate);
        setStartDate(formatted);
      } else {
        setEndDate(formatted);
        setIsCalendarOpen(false); // Cierra al elegir rango completo
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDoctorId("all");
    setStartDate("");
    setEndDate("");
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

  const handleLoadReport = (report: Report) => {
    localStorage.setItem("clinica_session", JSON.stringify({
      rawText: report.rawText,
      structuredReport: report.structuredText,
      currentReportId: report.id,
      mode: "correct",
      detectedDoctorId: report.doctorId || null,
      detectedDoctorName: report.doctorName || null,
      detectedDoctorSpecialty: report.doctorSpecialty || null,
      activeDoctorId: report.doctorId || null,
      action: "load"
    }));
    router.push("/");
  };

  const convertReportToClipboardHtml = (text: string): string => {
    if (!text) return "";

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

  const handleCopyClipboard = async (text: string) => {
    if (!text) return;

    const clipboardHtml = convertReportToClipboardHtml(text);
    // Texto plano con saltos de línea y sin asteriscos, añadiendo un salto de línea previo al título
    const plainText = "\n" + text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\t/g, " ");

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

    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const convertReportToHtml = (text: string): string => {
    if (!text) return "";

    // Si el texto ya contiene tags HTML significativos, devolver tal cual
    const trimmedCheck = text.trim();
    if (trimmedCheck.startsWith("<div") || trimmedCheck.startsWith("<p") || /<(p|div|strong|br|u|em)\b/i.test(trimmedCheck)) {
      return text;
    }

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

    const emptyLine = `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: #ffffff;">&nbsp;</p>`;

    const resultParagraphs: string[] = [];
    let lastPushedEmpty = false;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (!trimmed) {
        if (!lastPushedEmpty && resultParagraphs.length > 0) {
          resultParagraphs.push(emptyLine);
          lastPushedEmpty = true;
        }
        return;
      }

      const isFullyBold = /^\*\*[^*]+\*\*$/.test(trimmed);
      const isTitle = idx === firstNonEmptyIdx && isFullyBold;

      if (isTitle) {
        const titleText = trimmed.replace(/^\*\*|\*\*$/g, "");
        const titleHtml = `<p align="center" style="text-align: center; font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; background-color: #ffffff;"><u><strong>${titleText}</strong></u></p>`;
        
        resultParagraphs.push(titleHtml);
        resultParagraphs.push(emptyLine);
        lastPushedEmpty = true;
      } else if (isFullyBold) {
        const headerText = trimmed.replace(/^\*\*|\*\*$/g, "");
        const headerHtml = `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: #ffffff;"><strong>${headerText}</strong></p>`;
        
        if (!lastPushedEmpty && resultParagraphs.length > 0) {
          resultParagraphs.push(emptyLine);
        }
        resultParagraphs.push(headerHtml);
        resultParagraphs.push(emptyLine);
        lastPushedEmpty = true;
      } else {
        let formattedLine = trimmed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        formattedLine = formattedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        resultParagraphs.push(
          `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: #ffffff;">${formattedLine}</p>`
        );
        lastPushedEmpty = false;
      }
    });

    return `<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; background-color: #ffffff; line-height: 1.15; padding: 8px; text-align: left;">${resultParagraphs.join("")}</div>`;
  };

  const getstudyTypeColor = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes("eco")) return "bg-clinical-teal/10 text-clinical-teal border-clinical-teal/30";
    if (lower.includes("res") || lower.includes("rm")) return "bg-clinical-info-bg text-clinical-info-text border-clinical-info-border";
    if (lower.includes("rx") || lower.includes("rad")) return "bg-clinical-warning-bg text-clinical-warning-text border-clinical-warning-border/40";
    if (lower.includes("tac") || lower.includes("tom")) return "bg-clinical-danger-bg text-clinical-danger-text border-clinical-danger-border/40";
    if (lower.includes("mam")) return "bg-clinical-success-bg text-clinical-success-text border-clinical-success-border/40";
    return "bg-clinical-surface text-clinical-text-muted border-clinical-border";
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Sin fecha";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
          <span className="text-xs text-clinical-text-muted font-semibold tracking-wide">Cargando historial de informes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-clinical-bg text-clinical-text font-sans">
      
      {/* Sidebar de Navegación Lateral */}
      {/* Sidebar � oculto en m�vil, colapsado en tablet, expandido en desktop */}
      <AppSidebar
        isAdmin={isAdmin}
        isModerator={typeof window !== "undefined" && localStorage.getItem("role") === "moderator"}
        isDoctor={typeof window !== "undefined" && localStorage.getItem("role") === "doctor"}
        companyName={companyName}
        companyLogo={companyLogo}
        onLogout={handleLogout}
        isAuthenticated={typeof window !== "undefined" && !!(localStorage.getItem("token") || localStorage.getItem("admin_token"))}
      />


      {/* Workspace de Trabajo Principal */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
        {/* Mobile Nav */}
        <MobileNav
          isAdmin={isAdmin}
          isModerator={typeof window !== "undefined" && localStorage.getItem("role") === "moderator"}
          isDoctor={typeof window !== "undefined" && localStorage.getItem("role") === "doctor"}
          companyName={companyName}
          companyLogo={companyLogo}
          onLogout={handleLogout}
          isAuthenticated={typeof window !== "undefined" && !!(localStorage.getItem("token") || localStorage.getItem("admin_token"))}
        />
        
        {/* Top Navbar */}
        <header className="h-12 xl:h-14 2xl:h-16 border-b border-clinical-border hidden md:flex items-center justify-between px-4 xl:px-6 2xl:px-8 bg-clinical-panel shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide text-clinical-text">Historial de Trabajo</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-clinical-surface border border-clinical-border text-clinical-text-muted">Todos los informes</span>
          </div>

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
          </div>
        </header>

        {/* Contenido Principal */}
        <section className="flex-1 p-3 xl:p-4 2xl:p-6 overflow-y-auto xl:overflow-hidden flex flex-col space-y-3 xl:space-y-4 2xl:space-y-6 min-h-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-wide uppercase text-clinical-teal">Historial de Informes</h1>
              <p className="text-xs text-clinical-text-muted mt-1 leading-relaxed">
                Visualice, busque y cargue el historial completo de dictados médicos del centro.
              </p>
            </div>
            
            <button
              onClick={() => fetchReports(pagination.page, debouncedSearch, selectedDoctorId, startDate, endDate)}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {/* Barra de Filtros y Búsqueda Avanzada */}
          <div className="bg-clinical-panel border border-clinical-border rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3 shadow-lg shrink-0">
            {/* Buscador */}
            <div className="flex-1 relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por N° de informe o tipo de estudio (ej: mamaria)..."
                className="w-full bg-clinical-surface-inset border border-clinical-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-clinical-text placeholder-slate-500 focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/30 transition-all font-semibold"
              />
            </div>

            {/* Filtro por Médico */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-clinical-text-muted font-bold whitespace-nowrap">Médico:</span>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="bg-clinical-surface-inset border border-clinical-border rounded-xl px-3 py-2.5 text-xs text-clinical-text font-semibold focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/30 cursor-pointer min-w-[160px]"
                >
                  <option value="all">Todos los médicos</option>
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id.toString()}>{doc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Selector de Rango de Fechas (Calendario Shadcn-style) */}
            <div className="relative" ref={calendarRef}>
              <button
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-clinical-surface-inset border border-clinical-border hover:border-clinical-teal/50 hover:bg-clinical-teal/5 text-xs font-semibold text-clinical-text transition-all cursor-pointer min-w-[200px]"
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-clinical-text-muted" />
                  <span>
                    {startDate ? (
                      endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : `Desde ${formatDateForDisplay(startDate)}`
                    ) : "Rango de fechas"}
                  </span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-clinical-text-muted" />
              </button>

              {/* Calendario Flotante Popover */}
              {isCalendarOpen && (
                <div className="absolute right-0 mt-2 z-30 bg-clinical-panel border border-clinical-border rounded-2xl p-4 shadow-2xl w-[320px] animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Navegación del Calendario */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-clinical-text uppercase tracking-wide select-none">
                      {MONTHS_SPANISH[calendarMonth]} {calendarYear}
                    </span>
                    <button
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-clinical-text transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Nombres de los días */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-2 select-none">
                    {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map(d => (
                      <span key={d} className="text-[10px] font-bold text-clinical-text-muted">{d}</span>
                    ))}
                  </div>

                  {/* Celdas de los días del mes */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {Array.from({ length: getFirstDayOfMonth(calendarYear, calendarMonth) }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="w-8 h-8" />
                    ))}
                    {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const currentDate = new Date(calendarYear, calendarMonth, dayNum);
                      const dateStr = formatDateForBackend(currentDate);

                      const isStart = startDate === dateStr;
                      const isEnd = endDate === dateStr;
                      const inRange = startDate && endDate && currentDate > new Date(startDate) && currentDate < new Date(endDate);

                      let dayClass = "w-8 h-8 flex items-center justify-center text-xs rounded-lg transition-all cursor-pointer select-none ";
                      if (isStart || isEnd) {
                        dayClass += "bg-clinical-teal text-slate-950 font-bold shadow-md shadow-clinical-teal/15";
                      } else if (inRange) {
                        dayClass += "bg-clinical-teal/15 text-clinical-teal rounded-none";
                      } else {
                        dayClass += "hover:bg-clinical-surface-hover hover:text-clinical-text text-clinical-text-muted";
                      }

                      return (
                        <div
                          key={dayNum}
                          onClick={() => handleDayClick(dayNum)}
                          className={dayClass}
                        >
                          {dayNum}
                        </div>
                      );
                    })}
                  </div>

                  {/* Accesos Rápidos */}
                  <div className="border-t border-clinical-border-subtle mt-4 pt-3 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const today = new Date();
                          const formatted = formatDateForBackend(today);
                          setStartDate(formatted);
                          setEndDate(formatted);
                          setIsCalendarOpen(false);
                        }}
                        className="text-[10px] font-bold text-clinical-teal hover:underline cursor-pointer"
                      >
                        Hoy
                      </button>
                      <button
                        onClick={() => {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(end.getDate() - 7);
                          setStartDate(formatDateForBackend(start));
                          setEndDate(formatDateForBackend(end));
                          setIsCalendarOpen(false);
                        }}
                        className="text-[10px] font-bold text-clinical-teal hover:underline cursor-pointer"
                      >
                        Últimos 7 días
                      </button>
                    </div>
                    {(startDate || endDate) && (
                      <button
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                      >
                        Limpiar Rango
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Limpiar Filtros */}
            {(searchTerm || selectedDoctorId !== "all" || startDate || endDate) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 rounded-xl bg-clinical-danger-bg border border-clinical-danger-border hover:brightness-110 text-xs font-bold text-clinical-danger-text transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Limpiar Filtros
              </button>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-clinical-danger-bg border border-clinical-danger-border text-xs text-clinical-danger-text font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-clinical-danger-text shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tabla de Historial */}
          <div className="bg-clinical-panel border border-clinical-border rounded-xl overflow-hidden flex flex-col flex-1 shadow-lg min-h-0">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
                <span className="text-xs text-clinical-teal font-semibold tracking-wide">Cargando informes...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-clinical-text-muted">
                <div className="w-16 h-16 rounded-full bg-clinical-surface-inset border border-clinical-border flex items-center justify-center mb-4 text-clinical-text-muted">
                  <LayoutTemplate className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-sm text-clinical-text">No se encontraron informes</h3>
                <p className="text-xs max-w-xs mt-2 leading-relaxed">
                  Aún no se ha estructurado ningún dictado médico en la plataforma.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between overflow-auto min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-clinical-border text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted bg-clinical-surface-inset/50">
                      <th className="py-4 px-6">Informe</th>
                      <th className="py-4 px-6">Tipo de Estudio</th>
                      <th className="py-4 px-6">Médico / Especialidad</th>
                      <th className="py-4 px-6">IA Utilizada</th>
                      <th className="py-4 px-6">Fecha y Hora</th>
                      <th className="py-4 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clinical-border/40">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-clinical-surface/40 transition-all group">
                        <td className="py-4 px-6 font-semibold text-xs text-clinical-text">
                          <button
                            onClick={() => {
                              setSelectedReport(report);
                              setIsModalOpen(true);
                            }}
                            className="hover:text-clinical-teal font-bold transition-all text-left"
                          >
                            Informe #{report.id}
                          </button>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${getstudyTypeColor(report.reportType || "")}`}>
                            {report.reportType}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-xs font-semibold text-clinical-text">
                          <div className="flex flex-col">
                            <span>{report.doctorName || "General"}</span>
                            <span className="text-[10px] text-clinical-text-muted font-normal mt-0.5">{report.doctorSpecialty || "Sin médico asociado"}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            (report.aiType || '').includes('Nube') || (report.aiType || '').includes('Gemini')
                              ? 'bg-clinical-warning-bg text-clinical-warning-text border border-clinical-warning-border'
                              : 'bg-clinical-success-bg text-clinical-success-text border border-clinical-success-border'
                          }`}>
                            {report.aiType}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-xs text-clinical-text-muted font-medium">
                          {formatDate(report.createdAt)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedReport(report);
                                setIsModalOpen(true);
                              }}
                              className="p-2 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text border border-clinical-border transition-all cursor-pointer hover:scale-105"
                              title="Visualizar Reporte"
                              aria-label="Visualizar reporte"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleLoadReport(report)}
                              className="p-2 rounded-xl bg-clinical-surface hover:bg-clinical-teal/15 text-clinical-text-muted hover:text-clinical-teal border border-clinical-border hover:border-clinical-teal/30 transition-all cursor-pointer hover:scale-105"
                              title="Cargar en Dictador principal"
                              aria-label="Cargar reporte en el dictador principal"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Controles de Paginación */}
                <div className="p-4 border-t border-clinical-border flex items-center justify-between flex-wrap gap-4 bg-clinical-surface-inset/30 shrink-0">
                  <span className="text-xs text-clinical-text-muted font-medium">
                    Mostrando <span className="text-clinical-text font-bold">{(pagination.page - 1) * pagination.limit + 1}</span> a{" "}
                    <span className="text-clinical-text font-bold">
                      {Math.min(pagination.page * pagination.limit, pagination.totalItems)}
                    </span>{" "}
                    de <span className="text-clinical-text font-bold">{pagination.totalItems}</span> informes
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => fetchReports(pagination.page - 1, debouncedSearch, selectedDoctorId, startDate, endDate)}
                      disabled={pagination.page === 1}
                      className="px-3 py-1.5 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Anterior
                    </button>

                    {Array.from({ length: pagination.totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      const isActive = pageNum === pagination.page;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => fetchReports(pageNum, debouncedSearch, selectedDoctorId, startDate, endDate)}
                          className={`w-8 h-8 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-clinical-teal border-clinical-teal text-slate-950"
                              : "bg-clinical-surface border-clinical-border text-clinical-text hover:bg-clinical-surface-hover"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => fetchReports(pagination.page + 1, debouncedSearch, selectedDoctorId, startDate, endDate)}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-1.5 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modal de Detalle de Informe */}
      {isModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="modal-rounded-container bg-clinical-panel border border-clinical-border max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header del Modal */}
            <div className="p-6 border-b border-clinical-border hidden md:flex items-center justify-between shrink-0 bg-clinical-surface-inset/30 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-base text-clinical-text tracking-wide">
                  Detalles del Informe #{selectedReport.id}
                </h3>
                <p className="text-[10px] text-clinical-text-muted mt-0.5">
                  Estudio: {selectedReport.reportType} • Médico: {selectedReport.doctorName || "General"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-clinical-surface-inset/40 p-4 border border-clinical-border rounded-xl shrink-0">
                <div className="space-y-1.5">
                  <p className="text-clinical-text-muted font-medium">IA Utilizada: <span className="text-clinical-text font-bold">{selectedReport.aiType}</span></p>
                  <p className="text-clinical-text-muted font-medium">Médico Especialidad: <span className="text-clinical-text font-bold">{selectedReport.doctorSpecialty || "General"}</span></p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-clinical-text-muted font-medium">Fecha y Hora: <span className="text-clinical-text font-bold">{formatDate(selectedReport.createdAt)}</span></p>
                  <p className="text-clinical-text-muted font-medium">Médico: <span className="text-clinical-text font-bold">{selectedReport.doctorName || "General"}</span></p>
                </div>
              </div>

              {/* Visor de Hoja Estructurada */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-teal font-montserrat">Informe Estructurado Final</span>
                <div
                  className="report-paper p-8 outline-none select-text cursor-text shadow-md"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(convertReportToHtml(selectedReport.structuredText)) }}
                ></div>
              </div>

              {/* Dictado Bruto */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted font-montserrat">Texto del Dictado (Bruto)</span>
                <div className="bg-clinical-surface-inset/40 border border-clinical-border rounded-xl p-4 text-xs text-clinical-text-muted leading-relaxed select-text cursor-text max-h-[150px] overflow-y-auto">
                  {selectedReport.rawText}
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="p-4 border-t border-clinical-border flex items-center justify-between shrink-0 bg-clinical-surface-inset/30 flex-wrap gap-3 rounded-b-2xl">
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyClipboard(selectedReport.structuredText)}
                  className="px-4 py-2 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:border-clinical-teal/50 hover:text-clinical-teal"
                >
                  <Copy className="w-4 h-4" />
                  {copySuccess ? "¡Copiado!" : "Copiar a Portapapeles"}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover border border-clinical-border text-xs font-semibold text-clinical-text transition-all cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => handleLoadReport(selectedReport)}
                  className="px-5 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Cargar en Editor
                </button>
              </div>
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
    </div>
  );
}
