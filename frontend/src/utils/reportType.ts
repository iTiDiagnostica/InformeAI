/**
 * Extrae el tipo/título del estudio médico a partir del texto estructurado o dictado bruto.
 * Remueve marcado Markdown, etiquetas HTML, y prefijos como "INFORME DE ".
 */
export function extractReportType(structuredText?: string, rawText?: string): string {
  if (structuredText && typeof structuredText === 'string') {
    const lines = structuredText.split('\n');
    for (const line of lines) {
      // 1. Quitar etiquetas HTML
      let cleaned = line.replace(/<[^>]*>/g, '').trim();

      // 2. Quitar sintaxis Markdown (negrita **, encabezados #, subrayado <u>, etc.)
      cleaned = cleaned.replace(/^[\*\#\_\~`\s]+|[\*\#\_\~`\s]+$/g, '').trim();
      cleaned = cleaned.replace(/^\*\*|\*\*$/g, '').trim();

      // 3. Quitar dos puntos o guiones al inicio o final
      cleaned = cleaned.replace(/^[:\-\s]+|[:\-\s]+$/g, '').trim();

      if (!cleaned) continue;

      const lower = cleaned.toLowerCase();

      // Ignorar encabezados genéricos que no sean el título principal
      if (
        lower === 'conclusión' ||
        lower === 'conclusion' ||
        lower === 'factores de riesgo' ||
        lower === 'hallazgos' ||
        lower === 'informe editable' ||
        lower === 'informe'
      ) {
        continue;
      }

      // Quitar prefijos habituales como "INFORME DE ", "INFORME RADIOLÓGICO DE "
      if (cleaned.toUpperCase().startsWith('INFORME DE ')) {
        cleaned = cleaned.substring(11).trim();
      } else if (cleaned.toUpperCase().startsWith('INFORME RADIOLÓGICO DE ')) {
        cleaned = cleaned.substring(23).trim();
      } else if (cleaned.toUpperCase().startsWith('INFORME ')) {
        cleaned = cleaned.substring(8).trim();
      }

      // Si la línea resultante tiene una longitud válida para un título de estudio
      if (cleaned.length > 2 && cleaned.length < 120) {
        return cleaned;
      }
    }
  }

  // Fallback con el dictado bruto si no hay texto estructurado adecuado
  if (rawText && typeof rawText === 'string') {
    const firstLine = rawText.trim().split('\n')[0].trim();
    if (firstLine.length > 2 && firstLine.length < 100) {
      return firstLine;
    }
  }

  return 'Informe';
}
