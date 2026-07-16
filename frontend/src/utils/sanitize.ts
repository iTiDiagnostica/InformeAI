import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitiza código HTML para prevenir inyecciones XSS (Cross-Site Scripting).
 * Conserva solo las etiquetas y atributos de estilo seguros utilizados por nuestro editor médico.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'div', 'span', 'br', 'strong', 'em', 'u', 'b', 'i', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['style', 'align', 'id', 'class'],
    ALLOW_DATA_ATTR: false,
  }) as string;
}
