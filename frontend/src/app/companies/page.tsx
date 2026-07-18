"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { Plus, Pencil, Trash2, X, Check, Building } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";

interface Company {
  id: number;
  name: string;
  logoBase64?: string;

  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
}

interface ThemeVariant {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

interface BaseTheme {
  id: string;
  name: string;
  colorRepresentation: string;
  variants: ThemeVariant[];
}

const BASE_THEMES: BaseTheme[] = [
  {
    id: "celeste",
    name: "Celeste Clínico",
    colorRepresentation: "#0ea5e9",
    variants: [
      { name: "Deep Ocean (Original)", primary: "#0b0f19", secondary: "#111827", accent: "#0ea5e9" },
      { name: "Electric Cyan", primary: "#030712", secondary: "#0f172a", accent: "#06b6d4" },
      { name: "Soft Sky", primary: "#0f172a", secondary: "#1e293b", accent: "#38bdf8" },
      { name: "Midnight Ice", primary: "#070b13", secondary: "#101726", accent: "#67e8f9" },
      { name: "Royal Cobalt", primary: "#050a18", secondary: "#0b132b", accent: "#2563eb" },
      { name: "Light Sky (Claro)", primary: "#f0f9ff", secondary: "#ffffff", accent: "#0284c7" },
      { name: "Soft Turquoise (Claro)", primary: "#ecfeff", secondary: "#ffffff", accent: "#0891b2" },
      { name: "Clean Cyan (Claro)", primary: "#f5fbfb", secondary: "#ffffff", accent: "#06b6d4" },
      { name: "Frost Blue (Claro)", primary: "#f1f5f9", secondary: "#ffffff", accent: "#2563eb" },
      { name: "Bright Sky (Claro)", primary: "#e0f2fe", secondary: "#ffffff", accent: "#0ea5e9" }
    ]
  },
  {
    id: "rojo",
    name: "Rojo Vital",
    colorRepresentation: "#ef4444",
    variants: [
      { name: "Crimson Dark (Original)", primary: "#0a0505", secondary: "#140c0c", accent: "#ef4444" },
      { name: "Scarlet Glow", primary: "#0d0303", secondary: "#1b0a0a", accent: "#dc2626" },
      { name: "Ruby Rose", primary: "#0c0205", secondary: "#1c0d12", accent: "#f43f5e" },
      { name: "Burnt Ember", primary: "#0f0606", secondary: "#1c0f0f", accent: "#f97316" },
      { name: "Wine Berry", primary: "#0d040a", secondary: "#1a0a16", accent: "#db2777" },
      { name: "Pure Coral (Claro)", primary: "#fff5f5", secondary: "#ffffff", accent: "#e53e3e" },
      { name: "Soft Scarlet (Claro)", primary: "#fff5f5", secondary: "#fcf8f8", accent: "#c53030" },
      { name: "Light Pink Rose (Claro)", primary: "#fff1f2", secondary: "#ffffff", accent: "#e11d48" },
      { name: "Peach Whisper (Claro)", primary: "#fff7ed", secondary: "#ffffff", accent: "#ea580c" },
      { name: "Sweet Melon (Claro)", primary: "#fffaf8", secondary: "#fff5f0", accent: "#ff6b6b" }
    ]
  },
  {
    id: "verde",
    name: "Verde Esmeralda",
    colorRepresentation: "#10b981",
    variants: [
      { name: "Emerald Shadow (Original)", primary: "#02140f", secondary: "#08241d", accent: "#10b981" },
      { name: "Forest Dusk", primary: "#020f0a", secondary: "#061f14", accent: "#059669" },
      { name: "Lime Health", primary: "#050f05", secondary: "#0d200d", accent: "#84cc16" },
      { name: "Minty Fresh", primary: "#051210", secondary: "#0f2622", accent: "#34d399" },
      { name: "Tropical Teal", primary: "#010f10", secondary: "#052022", accent: "#0d9488" },
      { name: "Light Mint (Claro)", primary: "#f0fdf4", secondary: "#ffffff", accent: "#16a34a" },
      { name: "Eco Soft (Claro)", primary: "#f0fdf4", secondary: "#f5fdf7", accent: "#059669" },
      { name: "Bright Lime (Claro)", primary: "#f7fee7", secondary: "#ffffff", accent: "#65a30d" },
      { name: "Ocean Breeze (Claro)", primary: "#f0fdfa", secondary: "#ffffff", accent: "#0d9488" },
      { name: "Teal Essence (Claro)", primary: "#e6fffa", secondary: "#f0fff4", accent: "#008080" }
    ]
  },
  {
    id: "violeta",
    name: "Violeta Moderno",
    colorRepresentation: "#a855f7",
    variants: [
      { name: "Deep Purple (Original)", primary: "#080512", secondary: "#130f24", accent: "#a855f7" },
      { name: "Neon Orchid", primary: "#05020c", secondary: "#0d061a", accent: "#c084fc" },
      { name: "Amethyst Glow", primary: "#090414", secondary: "#160c2b", accent: "#8b5cf6" },
      { name: "Indigo Night", primary: "#03020d", secondary: "#0a081f", accent: "#6366f1" },
      { name: "Fuchsia Edge", primary: "#0a030c", secondary: "#180b1e", accent: "#d946ef" },
      { name: "Soft Lavender (Claro)", primary: "#faf5ff", secondary: "#ffffff", accent: "#9333ea" },
      { name: "Light Amethyst (Claro)", primary: "#f5f3ff", secondary: "#ffffff", accent: "#7c3aed" },
      { name: "Orchid Whisper (Claro)", primary: "#fdf4ff", secondary: "#ffffff", accent: "#c084fc" },
      { name: "Periwinkle Mist (Claro)", primary: "#eef2ff", secondary: "#ffffff", accent: "#4f46e5" },
      { name: "Bright Fuchsia (Claro)", primary: "#fdf4ff", secondary: "#ffffff", accent: "#d946ef" }
    ]
  },
  {
    id: "slate",
    name: "Monocromo Slate",
    colorRepresentation: "#e2e8f0",
    variants: [
      { name: "Slate Core (Original)", primary: "#05070b", secondary: "#0f131a", accent: "#e2e8f0" },
      { name: "Charcoal Edge", primary: "#090d16", secondary: "#111827", accent: "#9ca3af" },
      { name: "Silver Steel", primary: "#0f172a", secondary: "#1e293b", accent: "#cbd5e1" },
      { name: "Platinum Frost", primary: "#080b11", secondary: "#111622", accent: "#f1f5f9" },
      { name: "Graphite Dark", primary: "#030303", secondary: "#121212", accent: "#6b7280" },
      { name: "Silver Mist (Claro)", primary: "#f8fafc", secondary: "#ffffff", accent: "#475569" },
      { name: "Soft Platinum (Claro)", primary: "#f1f5f9", secondary: "#ffffff", accent: "#64748b" },
      { name: "Bright Chrome (Claro)", primary: "#f9fafb", secondary: "#ffffff", accent: "#374151" },
      { name: "Light Cool Gray (Claro)", primary: "#f3f4f6", secondary: "#f9fafb", accent: "#4b5563" },
      { name: "Carbon White (Claro)", primary: "#ffffff", secondary: "#f8fafc", accent: "#1f2937" }
    ]
  },
  {
    id: "ambar",
    name: "Ámbar Clínico",
    colorRepresentation: "#f59e0b",
    variants: [
      { name: "Golden Amber (Original)", primary: "#0a0805", secondary: "#17140f", accent: "#f59e0b" },
      { name: "Copper Warmth", primary: "#0d0804", secondary: "#1d120a", accent: "#d97706" },
      { name: "Bronze Light", primary: "#090704", secondary: "#18130d", accent: "#fbbf24" },
      { name: "Citrus Yellow", primary: "#0c0c04", secondary: "#1a1a0f", accent: "#eab308" },
      { name: "Sunset Orange", primary: "#0f0702", secondary: "#201007", accent: "#f97316" },
      { name: "Golden Glow (Claro)", primary: "#fffbeb", secondary: "#ffffff", accent: "#d97706" },
      { name: "Citrus Light (Claro)", primary: "#fefce8", secondary: "#ffffff", accent: "#ca8a04" },
      { name: "Honey Warmth (Claro)", primary: "#fffbeb", secondary: "#fffdf5", accent: "#b45309" },
      { name: "Amber Breeze (Claro)", primary: "#fff7ed", secondary: "#ffffff", accent: "#f59e0b" },
      { name: "Soft Orange (Claro)", primary: "#fffaf0", secondary: "#fff5e6", accent: "#e65c00" }
    ]
  },
  {
    id: "menta",
    name: "Pastel Menta",
    colorRepresentation: "#99f6e4",
    variants: [
      { name: "Teal Foam (Claro)", primary: "#f2fbf9", secondary: "#ffffff", accent: "#0f766e" },
      { name: "Teal Wave (Original)", primary: "#0d1112", secondary: "#161f20", accent: "#99f6e4" }, // reemplazando para consistencia
      { name: "Pale Turquoise", primary: "#080e0f", secondary: "#121e21", accent: "#a5f3fc" },
      { name: "Sage Calm", primary: "#0b0f0c", secondary: "#162119", accent: "#a7f3d0" },
      { name: "Ice Cyan", primary: "#05090b", secondary: "#0e181c", accent: "#e0f7fa" },
      { name: "Ice Mint (Claro)", primary: "#e6fffa", secondary: "#ffffff", accent: "#0d9488" },
      { name: "Sage Whisper (Claro)", primary: "#f4fbf7", secondary: "#ffffff", accent: "#15803d" },
      { name: "Light Aqua (Claro)", primary: "#ecfeff", secondary: "#ffffff", accent: "#0369a1" },
      { name: "Teal Wave Light (Claro)", primary: "#f0fdfa", secondary: "#ffffff", accent: "#0ea5e9" }
    ]
  }
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const [nameError, setNameError] = useState(false);
  
  // Colores por defecto en HEX correspondientes a los oklch originales
  const [colorPrimary, setColorPrimary] = useState("#0b0f19");   // slate-950/clinical bg
  const [colorSecondary, setColorSecondary] = useState("#111827"); // slate-900/clinical panel
  const [colorAccent, setColorAccent] = useState("#0ea5e9");    // sky-500/clinical accent

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modos de Edición
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Control del modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Delete Confirmation Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState("");
  const [selectedBaseTheme, setSelectedBaseTheme] = useState<string>("celeste");
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>("base");
  const router = useRouter();

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

  // Resolver API_URL
  const API_URL = "";

  const fetchCompanies = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/companies`, {
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
        setCompanies(data);
      } else {
        throw new Error("No se pudo obtener la lista de empresas.");
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar listado de empresas.");
    }
  }, [API_URL, router]);

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

    fetchCompanies();
  }, [fetchCompanies, router]);

  // Convertir archivo de imagen a Base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor seleccione un archivo de imagen válido.");
      return;
    }

    // Límite de tamaño sugerido: 5MB para evitar Base64 gigantescos
    if (file.size > 5 * 1024 * 1024) {
      setError("El logotipo es demasiado pesado. Tamaño máximo permitido: 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError("Error al procesar la imagen.");
    };
    reader.readAsDataURL(file);
  };



  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      setError("El nombre de la empresa es obligatorio.");
      return;
    }
    setNameError(false);

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const url = isEditMode
        ? `${API_URL}/api/companies/${editId}`
        : `${API_URL}/api/companies`;
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
          logoBase64,

          colorPrimary,
          colorSecondary,
          colorAccent
        })
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al procesar la empresa.");
      }

      setSuccess(
        isEditMode
          ? "Empresa actualizada con éxito."
          : "Empresa registrada con éxito."
      );

      // Limpiar Formulario
      setName("");
      setLogoBase64(null);

      setColorPrimary("#0b0f19");
      setColorSecondary("#111827");
      setColorAccent("#0ea5e9");
      setIsEditMode(false);
      setEditId(null);
      setNameError(false);

      // Cerrar modal automáticamente tras una pequeña pausa
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(null);
      }, 1500);

      fetchCompanies();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al conectar con el servidor.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (comp: Company) => {
    setName(comp.name);
    setLogoBase64(comp.logoBase64 || null);

    setColorPrimary(comp.colorPrimary);
    setColorSecondary(comp.colorSecondary);
    setColorAccent(comp.colorAccent);
    setIsEditMode(true);
    setEditId(comp.id);
    setNameError(false);

    // Intentar encontrar el tema base y la variante correspondiente
    let found = false;
    for (const base of BASE_THEMES) {
      for (let i = 0; i < base.variants.length; i++) {
        const v = base.variants[i];
        if (
          v.primary.toLowerCase() === comp.colorPrimary.toLowerCase() &&
          v.secondary.toLowerCase() === comp.colorSecondary.toLowerCase() &&
          v.accent.toLowerCase() === comp.colorAccent.toLowerCase()
        ) {
          setSelectedBaseTheme(base.id);
          setSelectedVariantIndex(i);
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      setSelectedBaseTheme("celeste");
      setSelectedVariantIndex(0);
    }

    setIsModalOpen(true);
  };

  const handleCancelEdit = () => {
    setName("");
    setLogoBase64(null);

    setColorPrimary("#0b0f19");
    setColorSecondary("#111827");
    setColorAccent("#0ea5e9");
    setIsEditMode(false);
    setEditId(null);
    setError(null);
    setSuccess(null);
    setNameError(false);
    setIsModalOpen(false);
  };

  const handleDeleteClick = (comp: Company) => {
    setDeleteTargetId(comp.id);
    setDeleteTargetTitle(comp.name);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return;
    setIsDeleteModalOpen(false);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/companies/${deleteTargetId}`, {
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
        setSuccess("Empresa eliminada exitosamente.");
        fetchCompanies();
      } else {
        throw new Error("No se pudo eliminar la empresa.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar la empresa.";
      setError(message);
    } finally {
      setDeleteTargetId(null);
      setDeleteTargetTitle("");
    }
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
          <span className="text-xs text-clinical-text-muted font-semibold tracking-wide">Cargando panel de marcas...</span>
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
            <span className="text-sm font-semibold tracking-wide text-clinical-text">Control de Branding</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-clinical-surface border border-clinical-border text-clinical-text-muted">Empresas e Identidades Visuales</span>
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

            {/* Botón Registrar Empresa (Oculto para Moderadores) */}
            {userRole === "admin" && (
              <button
                onClick={() => {
                  setName("");
                  setLogoBase64(null);
                  setColorPrimary("#0b0f19");
                  setColorSecondary("#111827");
                  setColorAccent("#0ea5e9");
                  setIsEditMode(false);
                  setEditId(null);
                  setNameError(false);
                  setSelectedBaseTheme("celeste");
                  setSelectedVariantIndex(0);
                  setError(null);
                  setSuccess(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold text-xs transition-all shadow-md shadow-clinical-teal/10 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Empresa</span>
              </button>
            )}
          </div>
        </header>

        {/* Zona del Tablero Principal */}
        <section className="flex-1 p-3 xl:p-4 2xl:p-6 overflow-y-auto min-h-0">
          
          {/* Listado de Empresas */}
          <div className="bg-clinical-panel border border-clinical-border rounded-2xl p-6 shadow-lg min-h-full">
            <div className="mb-6">
              <h2 className="text-md font-bold tracking-wide uppercase text-clinical-teal">Empresas Registradas</h2>
              <p className="text-xs text-clinical-text-muted mt-1">Gestione las marcas y configuraciones de color para cada una de las clínicas e instituciones médicas integradas.</p>
            </div>

            {/* Grid de Empresas */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {companies.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center text-center p-12 text-clinical-text-muted">
                  <div className="w-20 h-20 rounded-full bg-clinical-surface-inset border border-clinical-border flex items-center justify-center mb-4 text-clinical-text-muted">
                    <Building className="w-10 h-10" />
                  </div>
                  <h3 className="font-semibold text-base text-clinical-text">No hay empresas registradas</h3>
                  <p className="text-xs max-w-sm mt-2 leading-relaxed">
                    Haga clic en el botón "Registrar Empresa" en la esquina superior derecha para agregar una nueva clínica.
                  </p>
                </div>
              ) : (
                companies.map((comp) => {
                  // Buscar el nombre del tema base y la variante de colores
                  let themeName = "Personalizado";
                  let found = false;
                  for (const base of BASE_THEMES) {
                    for (const v of base.variants) {
                      if (
                        v.primary.toLowerCase() === comp.colorPrimary.toLowerCase() &&
                        v.secondary.toLowerCase() === comp.colorSecondary.toLowerCase() &&
                        v.accent.toLowerCase() === comp.colorAccent.toLowerCase()
                      ) {
                        themeName = `${base.name} (${v.name})`;
                        found = true;
                        break;
                      }
                    }
                    if (found) break;
                  }

                  return (
                    <div
                      key={comp.id}
                      className="p-5 bg-clinical-surface-inset/40 border border-clinical-border rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-black/25 relative group"
                    >
                      <div>
                        {/* Cabecera del Card sin ID de Empresa */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base font-bold text-clinical-text truncate" title={comp.name}>
                              {comp.name}
                            </h4>
                          </div>
                          
                          {comp.logoBase64 ? (
                            <div className="w-12 h-12 rounded-xl bg-clinical-surface border border-clinical-border flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                              <img src={comp.logoBase64} alt={comp.name} className="max-h-full max-w-full object-contain" />
                            </div>
                          ) : (
                            <span className="w-12 h-12 rounded-xl bg-clinical-surface border border-clinical-border flex items-center justify-center shrink-0 text-clinical-text-muted">
                              <Building className="w-6 h-6" />
                            </span>
                          )}
                        </div>

                        {/* Detalle de Colores Simplificado sin textos ni códigos */}
                        <div className="flex items-center justify-between bg-clinical-surface-inset/60 rounded-xl p-3.5 border border-clinical-border text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-clinical-text-muted font-semibold shrink-0">Tema aplicado:</span>
                            <span className="text-clinical-teal font-bold truncate max-w-[140px]" title={themeName}>{themeName}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            <div className="w-3.5 h-3.5 rounded-full border border-clinical-border/40 shadow-inner" style={{ backgroundColor: comp.colorPrimary }} title="Fondo" />
                            <div className="w-3.5 h-3.5 rounded-full border border-clinical-border/40 shadow-inner" style={{ backgroundColor: comp.colorSecondary }} title="Panel" />
                            <div className="w-3.5 h-3.5 rounded-full border border-clinical-border/40 shadow-inner" style={{ backgroundColor: comp.colorAccent }} title="Acento" />
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex gap-2.5 mt-5 pt-3 border-t border-clinical-border shrink-0">
                        <button
                          onClick={() => handleEdit(comp)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-clinical-surface hover:bg-clinical-teal/15 text-clinical-text-muted hover:text-clinical-teal border border-clinical-border hover:border-clinical-teal/20 transition-all text-xs font-semibold cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                          <span>Editar</span>
                        </button>
                        
                        {userRole === "admin" && (
                          <button
                            onClick={() => handleDeleteClick(comp)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-clinical-surface hover:bg-rose-950/30 text-clinical-text-muted hover:text-rose-400 border border-clinical-border hover:border-rose-900/40 transition-all text-xs font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Eliminar</span>
                          </button>
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

      {/* Modal de Registro/Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-clinical-panel border border-clinical-border rounded-3xl p-6 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col min-h-0 animate-in zoom-in-95 duration-200">
            
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-clinical-border mb-6 shrink-0">
              <div>
                <h2 className="text-lg font-bold tracking-wide uppercase text-clinical-teal">
                  {isEditMode ? "Modificar Empresa" : "Registrar Empresa"}
                </h2>
                <p className="text-[10px] text-clinical-text-muted mt-0.5">
                  Configure el logotipo institucional y los colores visuales para la clínica
                </p>
              </div>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 rounded-xl hover:bg-clinical-surface-hover text-slate-500 hover:text-clinical-text transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-y-auto pr-1">
              
              {/* Columna Izquierda: Inputs del Formulario */}
              <form onSubmit={handleSave} className="space-y-5 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  {/* Nombre */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                      Nombre de la Empresa <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
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
                      placeholder="Ej: Clínica Santa Fe / Hospital de Clínicas"
                      className={`w-full bg-clinical-surface-inset border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold text-clinical-text ${
                        nameError
                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                          : "border-clinical-border focus:border-clinical-teal"
                      }`}
                    />
                  </div>

                  {/* Logotipo */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1.5 block">
                      Logotipo Corporativo (Imagen)
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="w-full text-xs text-clinical-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-clinical-surface file:text-clinical-text hover:file:bg-clinical-surface-hover file:cursor-pointer cursor-pointer border border-clinical-border rounded-xl p-1 bg-clinical-surface-inset/20"
                        />
                      </div>
                      {logoBase64 && (
                        <div className="w-12 h-12 rounded-xl bg-clinical-surface-inset border border-clinical-border p-1 flex items-center justify-center relative group overflow-hidden shrink-0">
                          <img src={logoBase64} alt="Logotipo cargado" className="max-h-full max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setLogoBase64(null)}
                            className="absolute inset-0 bg-rose-950/80 text-rose-300 text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>


                  {/* Selector de Dos Pasos */}
                  <div className="space-y-4 pt-1">
                    
                    {/* Paso 1: Seleccionar Color Base */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-2 block">
                        Paso 1: Seleccione Categoría de Color de Marca
                      </label>
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        {BASE_THEMES.map((theme) => {
                          const isSelected = selectedBaseTheme === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => {
                                setSelectedBaseTheme(theme.id);
                                setSelectedVariantIndex(0); // Reiniciar a la primera variante
                                const firstVariant = theme.variants[0];
                                setColorPrimary(firstVariant.primary);
                                setColorSecondary(firstVariant.secondary);
                                setColorAccent(firstVariant.accent);
                              }}
                              className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                                isSelected
                                  ? "bg-clinical-surface border-clinical-teal shadow-md shadow-clinical-teal/10"
                                  : "bg-clinical-surface-inset/20 border-clinical-border hover:border-clinical-teal/30"
                              }`}
                            >
                              <div className="w-4 h-4 rounded-full border border-clinical-border/40 shadow-inner" style={{ backgroundColor: theme.colorRepresentation }} />
                              <span className="text-[8px] font-bold text-clinical-text-muted truncate max-w-full px-0.5">{theme.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Paso 2: Seleccionar Variante */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-2 block">
                        Paso 2: Seleccione Variante de la Gama
                      </label>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {BASE_THEMES.find(b => b.id === selectedBaseTheme)?.variants.map((variant, idx) => {
                          const isSelected = selectedVariantIndex === idx;
                          return (
                            <button
                              key={variant.name}
                              type="button"
                              onClick={() => {
                                setSelectedVariantIndex(idx);
                                setColorPrimary(variant.primary);
                                setColorSecondary(variant.secondary);
                                setColorAccent(variant.accent);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all hover:scale-[1.005] cursor-pointer ${
                                isSelected
                                  ? "bg-clinical-surface border-clinical-teal shadow-sm shadow-clinical-teal/5"
                                  : "bg-clinical-surface-inset/20 border-clinical-border/80 hover:border-clinical-teal/30"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? "border-clinical-teal" : "border-slate-600"
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-clinical-teal" />}
                                </div>
                                <span className="text-xs font-semibold text-clinical-text">{variant.name}</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 shrink-0 ml-4">
                                <div className="w-3.5 h-3.5 rounded-full border border-clinical-border/40 shadow-inner" style={{ backgroundColor: variant.primary }} title="Fondo" />
                                <div className="w-3.5 h-3.5 rounded-full border border-clinical-border/40 shadow-inner" style={{ backgroundColor: variant.secondary }} title="Panel" />
                                <div className="w-3.5 h-3.5 rounded-full border border-clinical-border/40 shadow-inner" style={{ backgroundColor: variant.accent }} title="Acento" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-clinical-border space-y-4">
                  {/* Mensajes del Formulario */}
                  {error && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800 text-[11px] text-rose-300 font-medium shrink-0">
                      ⚠️ {error}
                    </div>
                  )}
                  {success && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-[11px] text-emerald-300 font-medium shrink-0">
                      ✅ {success}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 py-2.5 rounded-xl bg-clinical-surface hover:bg-clinical-surface-hover text-clinical-text font-bold tracking-wide transition-all border border-clinical-border flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !name.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                    >
                      {isLoading ? (
                        <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{isEditMode ? "Guardar Cambios" : "Registrar Marca"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Columna Derecha: Vista Previa */}
              <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-clinical-border pt-6 lg:pt-0 lg:pl-6 h-full min-h-0">
                <div className="mb-4 shrink-0">
                  <h3 className="text-xs font-bold tracking-wider uppercase text-clinical-text-muted mb-1">
                    Vista Previa de Marca (Live Demo)
                  </h3>
                  <p className="text-[10px] text-clinical-text-muted">
                    Visualice en tiempo real cómo se adaptará la interfaz para este perfil de marca
                  </p>
                </div>

                {(() => {
                  const isLight = (() => {
                    if (!colorPrimary) return false;
                    const cleanHex = colorPrimary.replace("#", "");
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
                  })();

                  const previewStyle = {
                    backgroundColor: colorPrimary,
                    "--clinical-text": isLight ? "#0f172a" : "oklch(0.97 0.005 195)",
                    "--clinical-text-muted": isLight ? "#475569" : "oklch(0.65 0.015 195)",
                    "--clinical-teal": colorAccent,
                    color: "var(--clinical-text)",
                  } as React.CSSProperties;

                  return (
                    <div 
                      className="flex-1 border border-clinical-border/80 rounded-2xl p-6 flex gap-4 text-xs overflow-hidden select-none transition-colors min-h-[300px]"
                      style={previewStyle}
                    >
                      {/* Minisidebar */}
                      <div 
                        className="w-1/3 rounded-xl border border-clinical-border/80 p-3 flex flex-col justify-between"
                        style={{ backgroundColor: colorSecondary }}
                      >
                        <div className="space-y-3">
                          <div className="h-8 flex items-center justify-center border-b border-clinical-border/50 pb-2 shrink-0">
                            {logoBase64 ? (
                              <img src={logoBase64} alt="Preview Logo" className="max-h-full max-w-full object-contain" />
                            ) : (
                              <span className="text-[10px] font-extrabold text-clinical-text tracking-wider truncate">{name || "CLINICA"}</span>
                            )}
                          </div>
                          <div className="h-6 rounded-lg flex items-center px-2 gap-1 text-[8px] font-bold" style={{ backgroundColor: `${colorAccent}20`, color: colorAccent, border: `1px solid ${colorAccent}40` }}>
                            🎙️ Dictador
                          </div>
                          <div className="h-6 rounded-lg flex items-center px-2 gap-1 text-[8px] font-bold text-clinical-text-muted">
                            📁 Plantillas
                          </div>
                        </div>
                        <div className="h-5 rounded-lg bg-rose-950/20 text-rose-400 border border-rose-900/30 text-[7px] font-bold flex items-center justify-center shrink-0">
                          Salir
                        </div>
                      </div>

                      {/* Miniworkplace */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="h-8 rounded-xl border border-clinical-border/80 flex items-center justify-between px-3" style={{ backgroundColor: colorSecondary }}>
                          <span className="text-[7px] text-clinical-text-muted font-bold">Historial</span>
                          <span className="text-[7px] px-2 py-0.5 rounded bg-clinical-teal/20 text-clinical-teal text-[6px] font-bold">Activo</span>
                        </div>

                        <div className="flex-1 border border-clinical-border/60 rounded-xl p-3 my-3 flex flex-col justify-center items-center gap-2 bg-clinical-surface/20">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold transition-all" style={{ backgroundColor: colorAccent, boxShadow: `0 0 12px ${colorAccent}50` }}>
                            🎙️
                          </div>
                          <span className="text-[8px] text-clinical-text-muted text-center font-bold">Grabar dictado clínico</span>
                        </div>

                        <div className="h-6 flex gap-3 shrink-0">
                          <div className="flex-1 rounded-lg" style={{ backgroundColor: `${colorAccent}15`, border: `1px solid ${colorAccent}40` }} />
                          <div className="flex-1 rounded-lg bg-clinical-surface border border-clinical-border" />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
      )}
      {/* Modal de Confirmación de Eliminación Estilizado */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Eliminar Empresa"
        message={`¿Está seguro de eliminar esta empresa "${deleteTargetTitle}"? Todos los médicos asociados dejarán de tener marca corporativa y sus plantillas de referencia pasarán a ser inaccesibles para ellos.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
