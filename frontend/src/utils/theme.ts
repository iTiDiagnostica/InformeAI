/**
 * Utilidad compartida para aplicar y limpiar el tema corporativo en todas las páginas.
 * Centraliza la lógica de detección de luminancia y asignación de variables CSS
 * para evitar duplicación entre page.tsx, historial, doctors, templates, moderators, companies.
 */

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
  "--clinical-danger-bg",
  "--clinical-danger-text",
  "--clinical-danger-border",
  "--clinical-warning-bg",
  "--clinical-warning-text",
  "--clinical-warning-border",
  "--clinical-info-bg",
  "--clinical-info-text",
  "--clinical-info-border",
  "--clinical-success-bg",
  "--clinical-success-text",
  "--clinical-success-border",
];

export const isColorLight = (hex: string): boolean => {
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

export interface CompanyTheme {
  primary?: string;
  secondary?: string;
  accent?: string;
  [key: string]: unknown;
}

/**
 * Aplica un tema corporativo a las variables CSS del documentElement.
 * Si `theme` es null/undefined, limpia todas las variables para volver al tema base.
 */
export const applyTheme = (theme: CompanyTheme | null | undefined): void => {
  const root = document.documentElement;

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

        root.style.setProperty("--clinical-danger-bg", "#fee2e2");
        root.style.setProperty("--clinical-danger-text", "#991b1b");
        root.style.setProperty("--clinical-danger-border", "#fca5a5");

        root.style.setProperty("--clinical-warning-bg", "#fef9c3");
        root.style.setProperty("--clinical-warning-text", "#854d0e");
        root.style.setProperty("--clinical-warning-border", "#fde047");

        root.style.setProperty("--clinical-info-bg", "#e0f2fe");
        root.style.setProperty("--clinical-info-text", "#0369a1");
        root.style.setProperty("--clinical-info-border", "#7dd3fc");

        root.style.setProperty("--clinical-success-bg", "#d1fae5");
        root.style.setProperty("--clinical-success-text", "#065f46");
        root.style.setProperty("--clinical-success-border", "#6ee7b7");
      } else {
        [
          "--clinical-text",
          "--clinical-text-muted",
          "--clinical-surface",
          "--clinical-surface-hover",
          "--clinical-surface-inset",
          "--clinical-border",
          "--clinical-border-subtle",
          "--clinical-danger-bg",
          "--clinical-danger-text",
          "--clinical-danger-border",
          "--clinical-warning-bg",
          "--clinical-warning-text",
          "--clinical-warning-border",
          "--clinical-info-bg",
          "--clinical-info-text",
          "--clinical-info-border",
          "--clinical-success-bg",
          "--clinical-success-text",
          "--clinical-success-border",
        ].forEach((v) => root.style.removeProperty(v));
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
    ALL_THEME_VARS.forEach((v) => root.style.removeProperty(v));
  }
};
