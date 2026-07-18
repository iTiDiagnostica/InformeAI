"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, FileText, LayoutTemplate, Users, UserCheck, Building, Lock, Key, History } from "lucide-react";

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
      icon: <Mic className="w-5 h-5 shrink-0" />,
      show: true,
    },
    {
      href: "/historial",
      label: "Historial de Informes",
      icon: <History className="w-5 h-5 shrink-0" />,
      show: true,
    },
    {
      href: "/templates",
      label: isAdmin || isModerator ? "Plantillas" : "Mis Plantillas",
      icon: <FileText className="w-5 h-5 shrink-0" />,
      show: isAdmin || isModerator || isDoctor,
    },
    {
      href: "/doctors",
      label: "Médicos",
      icon: <Users className="w-5 h-5 shrink-0" />,
      show: isAdmin || isModerator,
    },
    {
      href: "/moderators",
      label: "Moderadores",
      icon: <UserCheck className="w-5 h-5 shrink-0" />,
      show: isAdmin,
    },
    {
      href: "/companies",
      label: "Empresas",
      icon: <Building className="w-5 h-5 shrink-0" />,
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
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
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
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className={isMobile ? '' : 'hidden xl:inline'}>Cerrar Sesión {isAdmin ? "Admin" : ""}</span>
            </button>
          ) : (
            <Link
              href="/login"
              onClick={handleClick}
              className={`flex items-center justify-center gap-2 w-full ${isMobile ? 'px-4 py-3' : 'px-2 py-2.5 xl:px-4'} rounded-lg text-xs font-bold text-clinical-teal hover:bg-clinical-teal/10 border border-clinical-teal/20 transition-all text-center cursor-pointer`}
              title="Acceso al Sistema"
            >
              <Key className="w-3.5 h-3.5 shrink-0" />
              <span className={isMobile ? '' : 'hidden xl:inline'}>Acceso al Sistema</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
