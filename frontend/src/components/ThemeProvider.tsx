"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";

const ALL_THEME_VARS = [
  "--clinical-bg",
  "--clinical-panel",
  "--clinical-panel-light",
  "--clinical-teal",
  "--clinical-teal-dim",
  "--clinical-text",
  "--clinical-text-muted",
  "--clinical-surface",
  "--clinical-surface-hover",
  "--clinical-surface-inset",
  "--clinical-border",
  "--clinical-border-subtle",
];

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    const clearAllVars = () => {
      ALL_THEME_VARS.forEach((v) => root.style.removeProperty(v));
    };

    // Forzar colores base del sistema en la pantalla de login
    if (pathname === "/login") {
      clearAllVars();
      return;
    }

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

    const companyThemeStr = localStorage.getItem("companyTheme");

    if (companyThemeStr) {
      try {
        const theme = JSON.parse(companyThemeStr);
        if (theme) {
          if (theme.primary) {
            root.style.setProperty("--clinical-bg", theme.primary);
            if (isColorLight(theme.primary)) {
              // Texto oscuro sobre fondo claro
              root.style.setProperty("--clinical-text", "#0f172a");
              root.style.setProperty("--clinical-text-muted", "#475569");
              // Superficies claras para botones/inputs
              root.style.setProperty("--clinical-surface", "#e2e8f0");
              root.style.setProperty("--clinical-surface-hover", "#cbd5e1");
              root.style.setProperty("--clinical-surface-inset", "#f1f5f9");
              // Bordes claros
              root.style.setProperty("--clinical-border", "#cbd5e1");
              root.style.setProperty("--clinical-border-subtle", "#e2e8f0");
            } else {
              root.style.removeProperty("--clinical-text");
              root.style.removeProperty("--clinical-text-muted");
              root.style.removeProperty("--clinical-surface");
              root.style.removeProperty("--clinical-surface-hover");
              root.style.removeProperty("--clinical-surface-inset");
              root.style.removeProperty("--clinical-border");
              root.style.removeProperty("--clinical-border-subtle");
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
          return;
        }
      } catch (err) {
        console.error("Error al parsear el tema corporativo:", err);
      }
    }
    
    // Si no hay tema corporativo, limpiar variables custom para usar defaults de CSS
    clearAllVars();
  }, [pathname]);

  return <>{children}</>;
}

