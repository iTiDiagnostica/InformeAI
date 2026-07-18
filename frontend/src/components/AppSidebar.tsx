"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AppSidebarProps {
  isAdmin: boolean;
  isModerator?: boolean;
  isDoctor?: boolean;
  companyName: string | null;
  companyLogo: string | null;
  isMaximized?: boolean;
  onLogout?: () => void;
  isAuthenticated?: boolean;
  /** When used inside mobile Sheet, renders full-width expanded */
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
}

export function AppSidebar({
  isAdmin,
  isModerator = false,
  isDoctor = false,
  companyName,
  companyLogo,
  isMaximized = false,
  onLogout,
  isAuthenticated = false,
  variant = "desktop",
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();
  const isMobile = variant === "mobile";

  const navItems: NavItem[] = [
    {
      href: "/",
      label: "Dictador de Voz",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
        </svg>
      ),
      show: true,
    },
    {
      href: "/historial",
      label: "Historial de Informes",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664v.75h6V4.5c0-.231.035-.454.1-.664M11.25 1.5a2.25 2.25 0 0 0-2.25 2.25v15.75a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25V3.75a2.25 2.25 0 0 0-2.25-2.25h-7.5Z" />
        </svg>
      ),
      show: true,
    },
    {
      href: "/templates",
      label: isAdmin || isModerator ? "Plantillas" : "Mis Plantillas",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
      show: isAdmin || isModerator || isDoctor,
    },
    {
      href: "/doctors",
      label: "Médicos",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
      show: isAdmin || isModerator,
    },
    {
      href: "/moderators",
      label: "Moderadores",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ),
      show: isAdmin,
    },
    {
      href: "/companies",
      label: "Empresas",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h18v18H3V3Z" />
        </svg>
      ),
      show: isAdmin || isModerator,
    },
  ];

  const isActive = (href: string) => pathname === href;

  const handleClick = () => {
    if (onNavigate) onNavigate();
  };

  // Company Logo / Name section
  const renderLogo = () => {
    if (companyName && companyName.toLowerCase() === "sistema") {
      return (
        <>
          <span className={`text-lg font-extrabold tracking-widest text-clinical-teal uppercase select-none ${isMobile ? '' : 'hidden xl:block'}`}>
            Sistema
          </span>
          {!isMobile && (
            <span className="text-sm font-extrabold text-clinical-teal uppercase select-none block xl:hidden">
              SYS
            </span>
          )}
        </>
      );
    }
    if (companyLogo) {
      return <img src={companyLogo} alt={companyName || "Empresa"} className="h-10 w-auto object-contain" />;
    }
    if (companyName && companyName.toLowerCase() === "imagen diagnóstica") {
      return (
        <>
          <img src="/logoIDblanco.png" alt="Imagen Diagnóstica" className={`h-10 w-auto object-contain ${isMobile ? '' : 'hidden xl:block'}`} />
          {!isMobile && (
            <span className="text-base font-extrabold text-clinical-teal block xl:hidden">ID</span>
          )}
        </>
      );
    }
    if (companyName) {
      return (
        <>
          <span className={`text-md font-bold tracking-wider text-clinical-teal uppercase select-none truncate max-w-full px-2 ${isMobile ? '' : 'hidden xl:block'}`} title={companyName}>
            {companyName}
          </span>
          {!isMobile && (
            <span className="text-sm font-bold text-clinical-teal uppercase select-none block xl:hidden">
              {companyName.substring(0, 3).toUpperCase()}
            </span>
          )}
        </>
      );
    }
    return (
      <>
        <img src="/logoIDblanco.png" alt="Imagen Diagnóstica" className={`h-10 w-auto object-contain ${isMobile ? '' : 'hidden xl:block'}`} />
        {!isMobile && (
          <span className="text-base font-extrabold text-clinical-teal block xl:hidden">ID</span>
        )}
      </>
    );
  };

  if (!isMobile && isMaximized) {
    return null;
  }

  return (
    <aside
      className={
        isMobile
          ? "flex flex-col justify-between h-full bg-clinical-panel"
          : `hidden md:flex bg-clinical-panel border-clinical-border flex-col justify-between shrink-0 transition-all duration-300 w-14 xl:w-56 2xl:w-64 border-r`
      }
    >
      <div>
        {/* Logo */}
        <div className={`${isMobile ? 'h-14 px-5' : 'h-12 xl:h-14 px-3 xl:px-5'} border-b border-clinical-border flex items-center justify-center`}>
          {renderLogo()}
        </div>

        {/* Navigation */}
        <nav className={`${isMobile ? 'p-3' : 'p-2 xl:p-3'} space-y-1`}>
          {navItems.filter(item => item.show).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClick}
                className={`flex items-center ${isMobile ? 'justify-start px-4 py-3' : 'justify-center xl:justify-start px-3 py-2.5 xl:px-4 xl:py-3'} gap-3 rounded-lg text-sm font-semibold transition-all ${
                  active
                    ? "bg-clinical-teal/10 text-clinical-teal border border-clinical-teal/20"
                    : "text-clinical-text-muted hover:bg-clinical-surface-hover hover:text-clinical-text"
                }`}
                title={item.label}
              >
                {item.icon}
                <span className={isMobile ? '' : 'hidden xl:inline'}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer actions */}
      <div className="border-t border-clinical-border flex flex-col shrink-0">
        <div className={`${isMobile ? 'p-3' : 'p-2 xl:p-3'}`}>
          {isAuthenticated ? (
            <button
              onClick={() => {
                if (onLogout) onLogout();
                if (onNavigate) onNavigate();
              }}
              className={`flex items-center justify-center gap-2 w-full ${isMobile ? 'px-4 py-3' : 'px-2 py-2.5 xl:px-4'} rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-950/20 border border-rose-900/30 transition-all cursor-pointer`}
              title={`Cerrar Sesión ${isAdmin ? "Admin" : ""}`}
            >
              <span>🔒</span>
              <span className={isMobile ? '' : 'hidden xl:inline'}>Cerrar Sesión {isAdmin ? "Admin" : ""}</span>
            </button>
          ) : (
            <Link
              href="/login"
              onClick={handleClick}
              className={`flex items-center justify-center gap-2 w-full ${isMobile ? 'px-4 py-3' : 'px-2 py-2.5 xl:px-4'} rounded-lg text-xs font-bold text-clinical-teal hover:bg-clinical-teal/10 border border-clinical-teal/20 transition-all text-center cursor-pointer`}
              title="Acceso al Sistema"
            >
              <span>🔑</span>
              <span className={isMobile ? '' : 'hidden xl:inline'}>Acceso al Sistema</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
