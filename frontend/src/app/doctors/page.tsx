"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmationModal } from "../../components/ConfirmationModal";

import { Company, Doctor, DocumentItem as TemplateItem } from "@/types";
import { sanitizeHtml } from "@/utils/sanitize";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  
  // Estados para búsqueda de médicos
  const [searchTerm, setSearchTerm] = useState("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>("base");

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

    if (theme) {
      if (theme.primary) {
        root.style.setProperty("--clinical-bg", theme.primary);
        if (isColorLight(theme.primary)) {
          root.style.setProperty("--clinical-text", "#0f172a");
          root.style.setProperty("--clinical-text-muted", "#475569");
        } else {
          root.style.removeProperty("--clinical-text");
          root.style.removeProperty("--clinical-text-muted");
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
      root.style.removeProperty("--clinical-bg");
      root.style.removeProperty("--clinical-panel");
      root.style.removeProperty("--clinical-panel-light");
      root.style.removeProperty("--clinical-teal");
      root.style.removeProperty("--clinical-teal-dim");
      root.style.removeProperty("--clinical-text");
      root.style.removeProperty("--clinical-text-muted");
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
  }, []);

  // Estados para Perfil de Médico
  const [selectedDoctorProfile, setSelectedDoctorProfile] = useState<Doctor | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedTemplateInProfile, setSelectedTemplateInProfile] = useState<{ id: number; title: string; content: string } | null>(null);
  const [isFetchingProfileTemplate, setIsFetchingProfileTemplate] = useState(false);
  const [copySuccessProfile, setCopySuccessProfile] = useState(false);

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

    setCopySuccessProfile(true);
    setTimeout(() => setCopySuccessProfile(false), 2000);
  };

  const handleOpenDoctorProfile = (doc: Doctor) => {
    setSelectedDoctorProfile(doc);
    setSelectedTemplateInProfile(null);
    setIsProfileModalOpen(true);
  };

  const handlePreviewTemplateInProfile = async (templateId: number, title: string) => {
    setIsFetchingProfileTemplate(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/documents/${templateId}`, {
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
        throw new Error("No se pudo obtener el contenido de la plantilla.");
      }
      const data = await res.json();
      setSelectedTemplateInProfile({
        id: templateId,
        title: title,
        content: data.content
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar la plantilla.";
      setError(message);
    } finally {
      setIsFetchingProfileTemplate(false);
    }
  };

  const handleCopyTemplateInProfile = async (templateId: number) => {
    setIsFetchingProfileTemplate(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/documents/${templateId}`, {
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
        throw new Error("No se pudo obtener el contenido de la plantilla.");
      }
      const data = await res.json();
      await handleCopyClipboard(data.content);
      setSuccess(`Plantilla copiada al portapapeles.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al copiar la plantilla.";
      setError(message);
    } finally {
      setIsFetchingProfileTemplate(false);
    }
  };

  // Estados del Formulario
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [styleDirectives, setStyleDirectives] = useState("");
  const [nameError, setNameError] = useState(false);
  const [specialtyError, setSpecialtyError] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [associatedTemplateIds, setAssociatedTemplateIds] = useState<number[]>([]);

  // Estados de carga e interfaz
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isServerOnline, setIsServerOnline] = useState(false);

  // Modos de Edición
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Delete Confirmation Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState("");

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [activeAiModel, setActiveAiModel] = useState<string>("gemini");

  const router = useRouter();

  // Resolver API_URL
  const API_URL = "";

  const fetchDoctors = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/doctors`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        router.push("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      } else {
        throw new Error("No se pudo obtener la lista de médicos.");
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar listado de médicos.");
    }
  }, [API_URL, router]);

  const fetchCompanies = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/companies`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
    }
  }, [API_URL]);

  const fetchTemplates = useCallback(async () => {
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
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [API_URL, router]);

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

  
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
    const role = localStorage.getItem("role");
    if (!token) {
      router.push("/login");
      return;
    }
    if (role !== "admin" && role !== "moderator") {
      router.push("/");
      return;
    }
    setIsAuthenticated(true);
    setIsAdmin(role === "admin");
    setUserRole(role || "");

    if (role === "moderator") {
      const themeStr = localStorage.getItem("companyTheme");
      if (themeStr) {
        try {
          const theme = JSON.parse(themeStr);
          if (theme && theme.id) {
            setCompanyId(theme.id);
            setSelectedCompanyId(theme.id.toString());
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    const timer = setTimeout(() => {
      fetchDoctors();
      fetchTemplates();
      fetchCompanies();
      fetchSettings();

      const checkHealth = async () => {
        try {
          const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
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
  }, [fetchDoctors, fetchTemplates, API_URL, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNameEmpty = !name.trim();
    const isSpecialtyEmpty = !specialty.trim();

    setNameError(isNameEmpty);
    setSpecialtyError(isSpecialtyEmpty);

    if (isNameEmpty || isSpecialtyEmpty) {
      setError("El nombre y la especialidad son campos obligatorios.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const url = isEditMode
        ? `${API_URL}/api/doctors/${editId}`
        : `${API_URL}/api/doctors`;
      const method = isEditMode ? "PUT" : "POST";
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          specialty,
          style_directives: styleDirectives,
          folder_name: folderName,
          documentIds: associatedTemplateIds,
          username,
          password,
          companyId: selectedCompanyId || null
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fallo al procesar perfil de médico.");
      }

      setSuccess(
        isEditMode
          ? "Perfil de médico actualizado con éxito."
          : "Médico registrado y configurado con éxito."
      );
      
      // Limpiar Formulario
      setName("");
      setSpecialty("");
      setStyleDirectives("");
      setNameError(false);
      setSpecialtyError(false);
      setFolderName("");
      setUsername("");
      setPassword("");
      setSelectedCompanyId(userRole === "moderator" && companyId ? companyId.toString() : "");
      setAssociatedTemplateIds([]);
      setIsEditMode(false);
      setEditId(null);
      setIsModalOpen(false);
      
      fetchDoctors();
      fetchTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al conectar con el servidor.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (doc: Doctor) => {
    setName(doc.name);
    setSpecialty(doc.specialty);
    setStyleDirectives(doc.style_directives || "");
    setFolderName(doc.folder_name || "");
    setUsername(doc.username || "");
    setPassword("");
    setSelectedCompanyId(doc.companyId ? doc.companyId.toString() : "");

    // Cargar las plantillas asociadas a este médico para evitar que se desasocien al guardar
    const docTemplates = templates.filter((t) => t.doctorId === doc.id);
    setAssociatedTemplateIds(docTemplates.map((t) => t.id));

    setIsEditMode(true);
    setEditId(doc.id);
    setNameError(false);
    setSpecialtyError(false);
    setIsModalOpen(true);
  };

  const handleCancelEdit = () => {
    setName("");
    setSpecialty("");
    setStyleDirectives("");
    setFolderName("");
    setUsername("");
    setPassword("");
    setSelectedCompanyId(userRole === "moderator" && companyId ? companyId.toString() : "");
    setAssociatedTemplateIds([]);
    setIsEditMode(false);
    setEditId(null);
    setError(null);
    setSuccess(null);
    setNameError(false);
    setSpecialtyError(false);
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

  const handleDeleteClick = (doc: Doctor) => {
    setDeleteTargetId(doc.id);
    setDeleteTargetTitle(doc.name);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return;
    setIsDeleteModalOpen(false);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/doctors/${deleteTargetId}`, {
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
        setSuccess("Médico eliminado exitosamente.");
        fetchDoctors();
        fetchTemplates();
      } else {
        throw new Error("No se pudo eliminar el médico.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar médico.";
      setError(message);
    } finally {
      setDeleteTargetId(null);
      setDeleteTargetTitle("");
    }
  };

  const handleCheckboxChange = (templateId: number) => {
    setAssociatedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  // Filtrar médicos del lado del cliente
  const filteredDoctors = doctors.filter((doc) => {
    const term = searchTerm.toLowerCase();
    return (
      doc.name.toLowerCase().includes(term) ||
      doc.specialty.toLowerCase().includes(term) ||
      (doc.folder_name && doc.folder_name.toLowerCase().includes(term))
    );
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

            <Link
              href="/templates"
              className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold text-clinical-text-muted hover:bg-slate-800/50 hover:text-clinical-text transition-all"
              title="Plantillas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <span className="hidden lg:inline">Plantillas</span>
            </Link>

            <Link
              href="/doctors"
              className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold bg-clinical-teal/10 text-clinical-teal border border-clinical-teal/20 transition-all"
              title="Médicos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span className="hidden lg:inline">Médicos</span>
            </Link>

            {userRole === "admin" && (
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
          </nav>
        </div>

        {/* Botón de Logout */}
        <div className="border-t border-slate-800 flex flex-col shrink-0">
          <div className="p-2 lg:p-4">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full px-2 py-2.5 lg:px-4 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-950/20 border border-rose-900/30 transition-all cursor-pointer"
              title="Cerrar Sesión Admin"
            >
              <span>🔒</span>
              <span className="hidden lg:inline">Cerrar Sesión Admin</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Workspace de Trabajo Principal */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-clinical-panel shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide text-clinical-text">Control de Personal</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-clinical-text-muted">Médicos y Perfiles</span>
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

            
            {/* Botón Registrar Médico (Oculto para médicos normales, visible para Admin y Moderadores) */}
            {(userRole === "admin" || userRole === "moderator") && (
              <button
                onClick={() => {
                  setName("");
                  setSpecialty("");
                  setStyleDirectives("");
                  setFolderName("");
                  setUsername("");
                  setPassword("");
                  setSelectedCompanyId(userRole === "moderator" && companyId ? companyId.toString() : "");
                  setIsEditMode(false);
                  setEditId(null);
                  setNameError(false);
                  setSpecialtyError(false);
                  setError(null);
                  setSuccess(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold text-xs transition-all shadow-md shadow-clinical-teal/10 cursor-pointer animate-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Registrar Médico</span>
              </button>
            )}

          </div>

        </header>

        {/* Zona del Tablero Principal */}
        <section className="flex-1 p-4 lg:p-6 overflow-y-auto min-h-0">

          {/* Listado de Médicos */}
          <div className="bg-clinical-panel border border-slate-800 rounded-2xl p-6 shadow-lg min-h-full">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-md font-bold tracking-wide uppercase text-clinical-teal">Médicos Registrados</h2>
                <p className="text-xs text-clinical-text-muted mt-1">Gestione el personal médico activo y personalice sus comportamientos</p>
              </div>
              
              {/* Barra de Búsqueda de Médicos */}
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar médico por nombre, especialidad..."
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredDoctors.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center text-center p-12 text-clinical-text-muted h-full">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm text-clinical-text">No se encontraron médicos</h3>
                  <p className="text-xs max-w-xs mt-2 leading-relaxed">
                    Ajuste los criterios de búsqueda o use el botón superior para registrar un médico.
                  </p>
                </div>
              ) : (
                filteredDoctors.map((doc) => {
                  const docTemplates = templates.filter((t) => t.doctorId === doc.id);
                  return (
                    <div
                      key={doc.id}
                      className="p-5 bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-black/25 relative group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center text-clinical-teal text-sm shrink-0">
                              🩺
                            </span>
                            <h4 className="text-sm font-bold truncate text-clinical-text" title={doc.name}>{doc.name}</h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[10px] text-clinical-text-muted mt-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-clinical-text font-semibold">
                            {doc.specialty}
                          </span>
                          {doc.companyName && (
                            <span className="px-2 py-0.5 rounded bg-clinical-teal/10 border border-clinical-teal/20 text-clinical-teal font-semibold">
                              🏢 {doc.companyName}
                            </span>
                          )}
                          {doc.username && (
                            <span className="px-2 py-0.5 rounded bg-slate-800/80 text-clinical-teal font-semibold">
                              👤 {doc.username}
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded bg-clinical-teal/5 border border-clinical-teal/10 text-clinical-teal font-semibold">
                            {docTemplates.length} Plantillas
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-1.5 mt-5 pt-3 border-t border-slate-800/50">
                        <button
                          onClick={() => handleOpenDoctorProfile(doc)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-clinical-teal/15 text-slate-500 hover:text-clinical-teal border border-slate-800 hover:border-clinical-teal/30 transition-all cursor-pointer"
                          title="Ver perfil de médico"
                          aria-label="Ver perfil de médico"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </button>
                        {(userRole === "admin" || userRole === "moderator") && (
                          <>
                            <button
                              onClick={() => handleEdit(doc)}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-clinical-teal/15 text-slate-500 hover:text-clinical-teal border border-slate-800 hover:border-clinical-teal/30 transition-all cursor-pointer"
                              title="Editar médico"
                              aria-label="Editar médico"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 18.75a4.409 4.409 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteClick(doc)}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 transition-all cursor-pointer"
                              title="Eliminar médico"
                              aria-label="Eliminar médico"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Formulario de Registro / Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-clinical-panel border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col min-h-0 animate-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 shrink-0">
              <div>
                <h2 className="text-md font-bold tracking-wide uppercase text-clinical-teal">
                  {isEditMode ? "Modificar Perfil" : "Registrar Médico"}
                </h2>
                <p className="text-[10px] text-clinical-text-muted mt-0.5">
                  {isEditMode ? "Modifique los parámetros del perfil seleccionado" : "Configure directivas de estilo e ingrese al sistema"}
                </p>
              </div>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-clinical-text transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                  Nombre Completo <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError && e.target.value.trim()) {
                      setNameError(false);
                    }
                  }}
                  placeholder="Ej: Dr. Gomez Araoz"
                  className={`w-full bg-slate-950/40 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold text-clinical-text ${
                    nameError
                      ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                      : "border-slate-800 focus:border-clinical-teal"
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                  Especialidad / Rol <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => {
                    setSpecialty(e.target.value);
                    if (specialtyError && e.target.value.trim()) {
                      setSpecialtyError(false);
                    }
                  }}
                  placeholder="Ej: Ecografía / Radiología"
                  className={`w-full bg-slate-950/40 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold text-clinical-text ${
                    specialtyError
                      ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                      : "border-slate-800 focus:border-clinical-teal"
                  }`}
                />
              </div>



              {userRole === "admin" && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                    Empresa / Institución Asociada
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold cursor-pointer text-clinical-text"
                  >
                    <option value="">-- Sin Empresa / General --</option>
                    {companies.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                    Nombre de Usuario
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej: dgomez"
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                    Contraseña 
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEditMode ? "••••••••" : "Ej: doctor123"}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold"
                  />
                </div>
              </div>



              {/* Respuestas de Acción */}
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-[11px] text-rose-300 font-medium">
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-[11px] text-emerald-300 font-medium">
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
                  disabled={isLoading || !name.trim() || !specialty.trim()}
                  className="flex-1 py-2 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs animate-none"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                  ) : (
                    <>
                      {isEditMode ? "Guardar Cambios" : "Dar de Alta"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Perfil de Médico */}
      {isProfileModalOpen && selectedDoctorProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-clinical-panel border border-slate-800 rounded-2xl max-w-5xl w-full h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/20">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center text-lg">
              🩺
            </span>
            <div>
              <h3 className="font-bold text-base text-clinical-text tracking-wide">
                Perfil de Personal: {selectedDoctorProfile.name}
              </h3>
              <p className="text-[10px] text-clinical-text-muted mt-0.5">
                Especialidad: {selectedDoctorProfile.specialty}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsProfileModalOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-clinical-text-muted hover:text-clinical-text transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Columna Izquierda: Detalles del Médico y Listado de Plantillas */}
          <div className="w-2/5 border-r border-slate-800 p-6 flex flex-col overflow-y-auto space-y-6">
            
            {/* Detalles del Médico */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-clinical-teal">Información del Médico</h4>
              <div className="bg-slate-950/30 border border-slate-800/80 rounded-xl p-4 space-y-3 text-xs">
                {selectedDoctorProfile.companyName && (
                  <div>
                    <span className="text-clinical-text-muted font-medium block">Empresa / Institución:</span>
                    <span className="text-clinical-text font-bold">🏢 {selectedDoctorProfile.companyName}</span>
                  </div>
                )}

              </div>
            </div>

            {/* Listado de Plantillas */}
            <div className="flex-1 flex flex-col min-h-[250px]">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-clinical-teal mb-3">Plantillas Asociadas ({templates.filter(t => t.doctorId === selectedDoctorProfile.id).length})</h4>
              <div className="flex-1 bg-slate-950/20 border border-slate-800/80 rounded-xl p-3 overflow-y-auto space-y-2">
                {templates.filter(t => t.doctorId === selectedDoctorProfile.id).length === 0 ? (
                  <p className="text-xs text-clinical-text-muted italic text-center mt-6">
                    Este médico no tiene plantillas exclusivas asociadas.
                  </p>
                ) : (
                  templates
                    .filter(t => t.doctorId === selectedDoctorProfile.id)
                    .map((temp) => {
                      const isSelected = selectedTemplateInProfile?.id === temp.id;
                      return (
                        <div
                          key={temp.id}
                          className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'bg-clinical-teal/10 border-clinical-teal text-clinical-text font-bold'
                              : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 text-clinical-text-muted hover:text-clinical-text font-semibold'
                          }`}
                        >
                          <span className="truncate flex-1 pr-1">{temp.title}</span>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => handlePreviewTemplateInProfile(temp.id, temp.title)}
                              className={`p-1.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-clinical-teal text-slate-950 border-clinical-teal'
                                  : 'bg-slate-900 hover:bg-clinical-teal/15 text-slate-400 hover:text-clinical-teal border-slate-800 hover:border-clinical-teal/30'
                              }`}
                              title="Visualizar en panel de la derecha"
                            >
                              Ver
                            </button>
                            <button
                              onClick={() => handleCopyTemplateInProfile(temp.id)}
                              className="p-1.5 rounded bg-slate-900 hover:bg-clinical-teal/15 text-slate-400 hover:text-clinical-teal border border-slate-800 hover:border-clinical-teal/30 text-[10px] font-semibold transition-all cursor-pointer"
                              title="Copiar contenido"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

          </div>

          {/* Columna Derecha: Previsualización de la Plantilla Activa */}
          <div className="w-3/5 p-6 flex flex-col overflow-hidden relative bg-slate-950/10">
            
            {isFetchingProfileTemplate && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-xs font-bold text-clinical-teal bg-clinical-panel border border-slate-800 px-4 py-2.5 rounded-xl shadow-lg animate-none">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-clinical-teal border-t-transparent animate-spin"></span>
                  <span>Cargando contenido de plantilla...</span>
                </div>
              </div>
            )}

            {selectedTemplateInProfile ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-clinical-teal">
                    Previsualización: {selectedTemplateInProfile.title}
                  </h4>
                  <button
                    onClick={() => handleCopyClipboard(selectedTemplateInProfile.content)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-clinical-text transition-all flex items-center gap-1.5 cursor-pointer animate-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.251 2.25 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h10.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6.75A1.5 1.5 0 0 1 5.25 21V9A1.5 1.5 0 0 1 6.75 7.5Z" />
                    </svg>
                    {copySuccessProfile ? "¡Copiado!" : "Copiar plantilla"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  <div
                    className="report-paper p-8 overflow-y-auto max-h-full outline-none select-text cursor-text border border-slate-200"
                    style={{ backgroundColor: "#ffffff", color: "#000000" }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(convertReportToHtml(selectedTemplateInProfile.content)) }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-clinical-text-muted">
                <div className="w-16 h-16 rounded-full bg-slate-900/60 border border-slate-800/80 flex items-center justify-center mb-4 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-sm text-clinical-text">Visualizar Estructura de Plantillas</h4>
                <p className="text-xs max-w-xs mt-2 leading-relaxed">
                  Haga clic en el botón "Ver" de cualquiera de las plantillas asociadas al médico para previsualizar su contenido aquí y copiarlo rápidamente.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* Footer del Modal */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/20 shrink-0">
          <button
            onClick={() => setIsProfileModalOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-clinical-text hover:bg-slate-800 transition-all cursor-pointer animate-none"
          >
            Cerrar Perfil
          </button>
        </div>

      </div>
    </div>
  )}
      {/* Modal de Confirmación de Eliminación Estilizado */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Eliminar Médico"
        message={`¿Está seguro de eliminar al médico "${deleteTargetTitle}"? Sus informes se mantendrán como generales, pero todas sus plantillas exclusivas se borrarán automáticamente del RAG.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}

