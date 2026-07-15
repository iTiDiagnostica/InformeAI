"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    // Forzar colores base del sistema en la pantalla de login
    if (pathname === "/login") {
      root.style.removeProperty("--clinical-bg");
      root.style.removeProperty("--clinical-panel");
      root.style.removeProperty("--clinical-panel-light");
      root.style.removeProperty("--clinical-teal");
      root.style.removeProperty("--clinical-teal-dim");
      return;
    }

    const companyThemeStr = localStorage.getItem("companyTheme");

    if (companyThemeStr) {
      try {
        const theme = JSON.parse(companyThemeStr);
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
          return;
        }
      } catch (err) {
        console.error("Error al parsear el tema corporativo:", err);
      }
    }
    
    // Si no hay tema corporativo, limpiar variables custom para usar defaults de CSS
    root.style.removeProperty("--clinical-bg");
    root.style.removeProperty("--clinical-panel");
    root.style.removeProperty("--clinical-panel-light");
    root.style.removeProperty("--clinical-teal");
    root.style.removeProperty("--clinical-teal-dim");
  }, [pathname]);

  return <>{children}</>;
}
