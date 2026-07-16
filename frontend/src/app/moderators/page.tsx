"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmationModal } from "../../components/ConfirmationModal";

interface Moderator {
  id: number;
  name: string;
  username: string;
  companyId: number;
  companyName?: string;
  createdAt: string;
}

interface Company {
  id: number;
  name: string;
  logoBase64?: string;
  faviconBase64?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  colorAccent?: string;
}

export default function ModeratorsPage() {
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Form States
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState(false);
  const [usernameError, setUsernameError] = useState(false);

  // Status States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isServerOnline, setIsServerOnline] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Edit Mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Delete Confirmation Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState("");

  // Theme & Branding States
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>("base");

  const router = useRouter();

  // Resolve API_URL
  const API_URL = "/api";

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
  }, []);

  const fetchModerators = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/moderators`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setModerators(data);
      } else {
        throw new Error("No se pudo obtener la lista de moderadores.");
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar listado de moderadores.");
    }
  }, [API_URL]);

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

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
    const role = localStorage.getItem("role");
    if (!token) {
      router.push("/login");
      return;
    }
    if (role !== "admin") {
      router.push("/");
      return;
    }
    setIsAuthenticated(true);
    setIsAdmin(true);

    const timer = setTimeout(() => {
      fetchModerators();
      fetchCompanies();

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
  }, [fetchModerators, fetchCompanies, API_URL, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNameEmpty = !name.trim();
    const isUsernameEmpty = !username.trim();

    setNameError(isNameEmpty);
    setUsernameError(isUsernameEmpty);

    if (isNameEmpty || isUsernameEmpty) {
      setError("El nombre y el usuario son obligatorios.");
      return;
    }

    if (!isEditMode && !password) {
      setError("La contraseña es obligatoria para nuevos moderadores.");
      return;
    }

    if (!selectedCompanyId) {
      setError("Debe seleccionar una Empresa / Institución Asociada.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const url = isEditMode
        ? `${API_URL}/api/moderators/${editId}`
        : `${API_URL}/api/moderators`;
      const method = isEditMode ? "PUT" : "POST";
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");

      const bodyPayload: any = {
        name,
        username,
        companyId: parseInt(selectedCompanyId)
      };
      if (password) {
        bodyPayload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(bodyPayload),
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fallo al guardar moderador.");
      }

      setSuccess(
        isEditMode
          ? "Moderador actualizado con éxito."
          : "Moderador registrado y configurado con éxito."
      );
      
      // Clear Form
      setName("");
      setUsername("");
      setPassword("");
      setSelectedCompanyId("");
      setNameError(false);
      setUsernameError(false);
      setIsEditMode(false);
      setEditId(null);
      setIsModalOpen(false);
      
      fetchModerators();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al conectar con el servidor.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (mod: Moderator) => {
    setName(mod.name);
    setUsername(mod.username);
    setPassword("");
    setSelectedCompanyId(mod.companyId ? mod.companyId.toString() : "");

    setIsEditMode(true);
    setEditId(mod.id);
    setNameError(false);
    setUsernameError(false);
    setIsModalOpen(true);
  };

  const handleCancelEdit = () => {
    setName("");
    setUsername("");
    setPassword("");
    setSelectedCompanyId("");
    setIsEditMode(false);
    setEditId(null);
    setError(null);
    setSuccess(null);
    setNameError(false);
    setUsernameError(false);
    setIsModalOpen(false);
  };

  const handleDeleteClick = (mod: Moderator) => {
    setDeleteTargetId(mod.id);
    setDeleteTargetTitle(mod.name);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return;
    setIsDeleteModalOpen(false);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/moderators/${deleteTargetId}`, {
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
        setSuccess("Moderador eliminado exitosamente.");
        fetchModerators();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || "No se pudo eliminar el moderador.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar moderador.";
      setError(message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setDeleteTargetId(null);
      setDeleteTargetTitle("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("companyTheme");
    applyTheme(null);
    router.push("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-clinical-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full border-4 border-clinical-teal border-t-transparent animate-spin"></span>
          <span className="text-xs text-clinical-text-muted font-semibold tracking-wide">Cargando panel de moderadores...</span>
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

            <Link
              href="/templates"
              className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold text-clinical-text-muted hover:bg-slate-800/50 hover:text-clinical-text transition-all"
              title="Plantillas RAG"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <span className="hidden lg:inline">Plantillas RAG</span>
            </Link>

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

            <Link
              href="/moderators"
              className="flex items-center justify-center lg:justify-start gap-3 px-3 py-3 lg:px-4 rounded-lg text-sm font-semibold bg-clinical-teal/10 text-clinical-teal border border-clinical-teal/20 transition-all"
              title="Moderadores"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              <span className="hidden lg:inline">Moderadores</span>
            </Link>

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
            <span className="text-sm font-semibold tracking-wide text-clinical-text">Control de Moderadores</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-clinical-text-muted">Administración de Tenants</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Selector de Vista Previa de Empresa */}
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

            {/* Botón Registrar Moderador */}
            <button
              onClick={() => {
                setName("");
                setUsername("");
                setPassword("");
                setSelectedCompanyId("");
                setIsEditMode(false);
                setEditId(null);
                setNameError(false);
                setUsernameError(false);
                setError(null);
                setSuccess(null);
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold text-xs transition-all shadow-md shadow-clinical-teal/10 cursor-pointer animate-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Registrar Moderador</span>
            </button>
          </div>
        </header>

        {/* Zona del Tablero Principal */}
        <section className="flex-1 p-4 lg:p-6 overflow-y-auto min-h-0">

          {/* Listado de Moderadores */}
          <div className="bg-clinical-panel border border-slate-800 rounded-2xl p-6 shadow-lg min-h-full">
            <div className="mb-6">
              <h2 className="text-md font-bold tracking-wide uppercase text-clinical-teal">Moderadores Registrados</h2>
              <p className="text-xs text-clinical-text-muted mt-1">Gestione los administradores delegados por cada empresa asociada</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {moderators.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center text-center p-12 text-clinical-text-muted h-full">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.947 11.947 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584v-.109m0 0v.003c0-1.113.285-2.16.786-3.07M7.037 16.289a4.125 4.125 0 0 0-7.533 2.493M9 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-3 9.75a9 9 0 0 0-9 0m9-9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm text-clinical-text">No hay moderadores</h3>
                  <p className="text-xs max-w-xs mt-2 leading-relaxed">
                    Registre administradores para sus empresas aliadas usando el botón superior.
                  </p>
                </div>
              ) : (
                moderators.map((mod) => {
                  return (
                    <div
                      key={mod.id}
                      className="p-5 bg-slate-950/40 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-black/25 relative group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center text-clinical-teal text-sm shrink-0">
                              👤
                            </span>
                            <h4 className="text-sm font-bold truncate text-clinical-text" title={mod.name}>{mod.name}</h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[10px] text-clinical-text-muted mt-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-clinical-text font-semibold">
                            Usuario: {mod.username}
                          </span>
                          {mod.companyName && (
                            <span className="px-2 py-0.5 rounded bg-clinical-teal/10 border border-clinical-teal/20 text-clinical-teal font-semibold">
                              🏢 {mod.companyName}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-slate-800/40 text-clinical-text-muted">
                            Creado: {new Date(mod.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-1.5 mt-5 pt-3 border-t border-slate-800/50">
                        <button
                          onClick={() => handleEdit(mod)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-clinical-teal/15 text-slate-500 hover:text-clinical-teal border border-slate-800 hover:border-clinical-teal/30 transition-all cursor-pointer"
                          title="Editar moderador"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 18.75a4.409 4.409 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(mod)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 transition-all cursor-pointer"
                          title="Eliminar moderador"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
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
                  {isEditMode ? "Modificar Moderador" : "Registrar Moderador"}
                </h2>
                <p className="text-[10px] text-clinical-text-muted mt-0.5">
                  {isEditMode ? "Modifique las credenciales y asignación del moderador" : "Cree cuentas de administración delegada de tenant"}
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
                  placeholder="Ej: Administrador Externo S.A."
                  className={`w-full bg-slate-950/40 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold text-clinical-text ${
                    nameError
                      ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                      : "border-slate-800 focus:border-clinical-teal"
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                  Nombre de Usuario <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameError && e.target.value.trim()) {
                      setUsernameError(false);
                    }
                  }}
                  placeholder="Ej: mod_clinica"
                  className={`w-full bg-slate-950/40 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold text-clinical-text ${
                    usernameError
                      ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 ring-2 ring-rose-500/20 animate-shake"
                      : "border-slate-800 focus:border-clinical-teal"
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                  Contraseña {isEditMode ? "" : <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEditMode ? "••••••••" : "Ej: contraseñaSecura123"}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-clinical-text-muted mb-1 block">
                  Empresa / Institución Asociada <span className="text-rose-500 font-bold ml-0.5 animate-pulse">*</span>
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-clinical-teal focus:ring-1 focus:ring-clinical-teal/50 transition-all font-semibold cursor-pointer text-clinical-text"
                >
                  <option value="">-- Seleccione una Empresa --</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Feedback */}
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
                  disabled={isLoading || !name.trim() || !username.trim() || (!isEditMode && !password) || !selectedCompanyId}
                  className="flex-1 py-2 rounded-xl bg-clinical-teal hover:bg-clinical-teal-dim text-slate-950 font-bold tracking-wide transition-all shadow-md shadow-clinical-teal/10 hover:shadow-clinical-teal/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs animate-none"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                  ) : (
                    <>{isEditMode ? "Guardar Cambios" : "Crear Moderador"}</>
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
        title="Eliminar Moderador"
        message={`¿Está seguro de que desea eliminar al moderador "${deleteTargetTitle}"? Esta acción no se puede deshacer.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}

