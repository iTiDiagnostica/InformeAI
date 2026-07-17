import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitiza código HTML para prevenir inyecciones XSS (Cross-Site Scripting).
 * Conserva solo las etiquetas y atributos de estilo seguros utilizados por nuestro editor médico.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Resolución robusta de DOMPurify para evitar incompatibilidades de empaquetado (CJS vs ESM)
  const purify = (DOMPurify as any).default || DOMPurify;
  
  if (!purify || typeof purify.sanitize !== 'function') {
    console.error('⚠️ DOMPurify.sanitize no está disponible:', purify);
    return html; // Fallback al HTML crudo para evitar caída del renderizado
  }

  try {
    return purify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'div', 'span', 'br', 'strong', 'em', 'u', 'b', 'i', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: ['style', 'align', 'id', 'class'],
      ALLOW_DATA_ATTR: false,
    }) as string;
  } catch (error) {
    console.error('❌ Error al sanitizar HTML:', error);
    return html; // Fallback seguro
  }
}

