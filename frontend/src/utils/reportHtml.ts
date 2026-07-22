/**
 * Convierte el contenido HTML enriquecido del editor contentEditable de vuelta a Markdown estándar (con **)
 */
export const convertHtmlToMarkdown = (html: string): string => {
  if (!html) return "";

  let text = html;

  // Normalizar saltos de línea de retorno de carro
  text = text.replace(/\r\n/g, "\n");

  // Reemplazar divs y párrafos por salto de línea simple para evitar el doble espaciado acumulativo
  // 1. Detectar alineaciones en párrafos y divs antes de borrarlos
  text = text.replace(/<(p|div)\s+[^>]*style=["']([^"']*)text-align:\s*(center|left|right|justify);?([^"']*)[^>]*>([\s\S]*?)<\/\1>/gi, '[ALIGN:$3]$5[/ALIGN]\n');
  text = text.replace(/<(p|div)\s+[^>]*align=["'](center|left|right|justify)["'][^>]*>([\s\S]*?)<\/\1>/gi, '[ALIGN:$2]$3[/ALIGN]\n');

  text = text.replace(/<div[^>]*>/gi, "");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "\n");

  // Reemplazar saltos de línea <br> por salto de línea simple
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 2. Extraer cursiva (font-style: italic) de spans
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)font-style:\s*italic;?([^"']*)[^>]*>([\s\S]*?)<\/span>/gi, (_match, beforeAttr, styleBefore, styleAfter, _afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}><em>${content}</em></span>`;
  });

  // 3. Extraer subrayado (text-decoration: underline) de spans
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)text-decoration:\s*underline;?([^"']*)[^>]*>([\s\S]*?)<\/span>/gi, (_match, beforeAttr, styleBefore, styleAfter, _afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}><u>${content}</u></span>`;
  });

  // 4. Extraer negrita (font-weight: bold / 700) de spans
  text = text.replace(/<span(\s+[^>]*)style=["']([^"']*)font-weight:\s*(?:bold|700);?([^"']*)[^>]*>([\s\S]*?)<\/span>/gi, (_match, beforeAttr, styleBefore, styleAfter, _afterAttr, content) => {
    const newStyle = (styleBefore + styleAfter).replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    const styleAttr = newStyle ? `style="${newStyle}"` : '';
    return `<span${beforeAttr} ${styleAttr}><strong>${content}</strong></span>`;
  });

  // Reemplazar <strong> y <b> por **
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");

  // Reemplazar <em> y <i> por *
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  text = text.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");

  // Preservar spans de tamaño de fuente convirtiéndolos a un marcador temporal antes de la limpieza del HTML residual
  let previousText;
  do {
    previousText = text;
    text = text.replace(/<span\s+[^>]*style=["'](?:[^"']*;)*\s*font-size:\s*([^;"'\s]+)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '[FONTSIZE:$1]$2[/FONTSIZE]');
  } while (text !== previousText);

  // Preservar subrayado convirtiéndolo a un marcador temporal para evitar que la limpieza de HTML lo borre
  text = text.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '[UNDERLINE]$1[/UNDERLINE]');

  // Quitar cualquier otra etiqueta HTML residual
  text = text.replace(/<[^>]+>/g, "");

  // Restaurar los marcadores de font-size a etiquetas HTML limpias para guardarlas en el markdown
  do {
    previousText = text;
    text = text.replace(/\[FONTSIZE:([^\]]+)\]([\s\S]*?)\[\/FONTSIZE\]/g, '<span style="font-size: $1">$2</span>');
  } while (text !== previousText);

  // Restaurar subrayado a etiquetas <u>
  do {
    previousText = text;
    text = text.replace(/\[UNDERLINE\]([\s\S]*?)\[\/UNDERLINE\]/g, '<u>$1</u>');
  } while (text !== previousText);

  // Restaurar alineaciones a párrafos con estilo inline
  do {
    previousText = text;
    text = text.replace(/\[ALIGN:([^\]]+)\]([\s\S]*?)\[\/ALIGN\]/g, '<p style="text-align: $1">$2</p>');
  } while (text !== previousText);

  // Decodificar entidades HTML comunes
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Limpiar espacios vacíos en las líneas
  text = text.split("\n").map(line => line.trim() === "" ? "" : line).join("\n");

  // Normalizar múltiples saltos de línea seguidos
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
};

// Limpieza para comparar HTML y evitar bucles de actualización
export const cleanHtmlForComparison = (html: string): string => {
  let cleaned = html.replace(/\s+/g, "");
  
  // Normalizar el atributo style reteniendo únicamente font-size y font-style
  cleaned = cleaned.replace(/style="([^"]*)"/g, (_match, styleContent: string) => {
    const fontSizeMatch = styleContent.match(/font-size:\s*([^;"]+)/);
    const fontStyleMatch = styleContent.match(/font-style:\s*([^;"]+)/);
    let normalizedStyle = "";
    if (fontSizeMatch) normalizedStyle += `font-size:${fontSizeMatch[1].trim()};`;
    if (fontStyleMatch) normalizedStyle += `font-style:${fontStyleMatch[1].trim()};`;
    return normalizedStyle ? `style="${normalizedStyle}"` : "";
  });

  return cleaned
    .replace(/class="[^"]*"/g, "")
    .replace(/&nbsp;/g, "")
    .replace(/<br\/?>/g, "\n")
    .replace(/<u>/g, "")
    .replace(/<\/u>/g, "")
    .replace(/<strong>/g, "")
    .replace(/<\/strong>/g, "")
    .replace(/<b>/g, "")
    .replace(/<\/b>/g, "")
    .trim();
};

// Convertir el texto del informe a HTML formateado para el editor contentEditable de la app
export const convertReportToHtml = (text: string): string => {
  if (!text || typeof text !== "string") return "";

  // Normalizar marcadores legacy a HTML para soportar datos guardados con el bug
  let legacyNormalizedText = text;
  let previousText;
  do {
    previousText = legacyNormalizedText;
    legacyNormalizedText = legacyNormalizedText.replace(/\[ALIGN:([^\]]+)\]([\s\S]*?)\[\/ALIGN\]/g, '<p style="text-align: $1">$2</p>');
  } while (legacyNormalizedText !== previousText);
  do {
    previousText = legacyNormalizedText;
    legacyNormalizedText = legacyNormalizedText.replace(/\[UNDERLINE\]([\s\S]*?)\[\/UNDERLINE\]/g, '<u>$1</u>');
  } while (legacyNormalizedText !== previousText);
  do {
    previousText = legacyNormalizedText;
    legacyNormalizedText = legacyNormalizedText.replace(/\[FONTSIZE:([^\]]+)\]([\s\S]*?)\[\/FONTSIZE\]/g, '<span style="font-size: $1">$2</span>');
  } while (legacyNormalizedText !== previousText);

  const cleanText = legacyNormalizedText.replace(/```html/g, "").replace(/```/g, "").replace(/\t/g, " ").trim();
  if (!cleanText) return "";

  const lines = cleanText.split("\n");

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

    // Si la línea ya es un bloque HTML (p, div, h1-6, etc.), la dejamos como está
    const isHtmlBlock = /^<\/?(p|div|h[1-6]|ul|ol|li)\b/i.test(trimmed);
    if (isHtmlBlock) {
      let formattedLine = trimmed
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
      resultParagraphs.push(formattedLine);
      lastPushedEmpty = false;
      return;
    }

    const isFullyBold = /^<strong>[^<]+<\/strong>$/i.test(trimmed) || /^\*\*[^*]+\*\*$/.test(trimmed);
    const isTitle = idx === firstNonEmptyIdx && isFullyBold;

    if (isTitle) {
      const titleText = trimmed.replace(/^<strong>|<\/strong>$/gi, "").replace(/^\*\*|\*\*$/g, "");
      const titleHtml = `<p align="center" style="text-align: center; font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; background-color: #ffffff;"><u><strong>${titleText}</strong></u></p>`;
      
      resultParagraphs.push(titleHtml);
      resultParagraphs.push(emptyLine);
      lastPushedEmpty = true;
    } else if (isFullyBold) {
      const headerText = trimmed.replace(/^<strong>|<\/strong>$/gi, "").replace(/^\*\*|\*\*$/g, "");
      const headerHtml = `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: #ffffff;"><strong>${headerText}</strong></p>`;
      
      if (!lastPushedEmpty && resultParagraphs.length > 0) {
        resultParagraphs.push(emptyLine);
      }
      resultParagraphs.push(headerHtml);
      resultParagraphs.push(emptyLine);
      lastPushedEmpty = true;
    } else {
      let formattedLine = trimmed
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
      resultParagraphs.push(
        `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; text-align: left; margin: 0; padding: 0; background-color: #ffffff;">${formattedLine}</p>`
      );
      lastPushedEmpty = false;
    }
  });

  return `<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; background-color: #ffffff; line-height: 1.15; padding: 8px; text-align: left;">${resultParagraphs.join("")}</div>`;
};

// Detecta si el texto devuelto por la IA es una advertencia/error de que el dictado no contiene información médica o es inválido
export const isAiWarningMessage = (text: string): boolean => {
  if (!text || typeof text !== "string") return false;
  const normalized = text.toLowerCase();
  
  // Para evitar falsos positivos con reportes clínicos válidos que contienen "no contiene hallazgos" o "no se detecta...",
  // requerimos que la advertencia haga referencia explícita al "dictado" o use frases de error de la IA muy específicas.
  const hasDictado = normalized.includes("dictado");
  const isInvalidError = normalized.includes("por favor, proporcione") || 
                         normalized.includes("no es posible estructurar") || 
                         normalized.includes("no se puede estructurar") ||
                         normalized.includes("no contiene información médica");
                         
  if (hasDictado && (
    normalized.includes("no contiene") || 
    normalized.includes("no es suficiente") || 
    normalized.includes("insuficiente") || 
    normalized.includes("no corresponde") ||
    normalized.includes("información médica") ||
    normalized.includes("datos suficientes")
  )) {
    return true;
  }
  
  return isInvalidError && hasDictado;
};

/**
 * Genera HTML MÍNIMO y limpio para copiar al portapapeles y pegar en editores de texto
 * enriquecido (Word online, editores clínicos).
 * Usa inline styles específicos para forzar la tipografía Arial 11pt, color negro,
 * fondo blanco y espaciado de párrafos para evitar que se colasen.
 */
export const convertReportToClipboardHtml = (text: string): string => {
  if (!text || typeof text !== "string") return "";

  const cleanText = text.replace(/```html/g, "").replace(/```/g, "").replace(/\t/g, " ");
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
      const emptyLineHtml = `<p style="font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; text-align: left; background-color: transparent;">&nbsp;</p>`;
      const titleHtml = `<p align="center" style="text-align: center; font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.15; margin: 0; padding: 0; background-color: transparent;"><u><strong>${titleText}</strong></u></p>`;
      return `${emptyLineHtml}\n${titleHtml}`;
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

/** Constantes de visualización */
export const AUDIO_WAVE_HEIGHTS = [30, 80, 45, 90, 60, 75, 40, 85, 50, 70];

/** Obtiene las iniciales de un nombre (quitando prefijos Dr./Dra.) */
export const getInitials = (name: string): string => {
  if (!name) return "";
  // Quitar prefijos comunes como Dr., Dra., etc.
  const cleanName = name.replace(/^(dr\.|dra\.|dr|dra)\s+/gi, "").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
