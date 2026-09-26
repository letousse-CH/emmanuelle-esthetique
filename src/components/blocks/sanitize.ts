/**
 * Nettoyage du HTML des blocs texte, côté serveur comme côté navigateur, sans
 * dépendance DOM : liste blanche de balises et d'attributs. Le contenu vient
 * de l'admin (Tiptap) ou de l'IA ; on retire tout ce qui peut exécuter du code.
 */
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'span']);

export function sanitizeHtml(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form|input|textarea|select|button|svg|math)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*([a-z0-9]+)([^>]*)>/gi, (full, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED.has(t)) return '';
      if (full.startsWith('</') || /^<\s*\//.test(full)) return `</${t}>`;
      if (t === 'a') {
        const href = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
        const url = (href?.[2] ?? href?.[3] ?? '').trim();
        const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url.replace(/"/g, '&quot;') : '#';
        const ext = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${safe}"${ext}>`;
      }
      return `<${t}>`;
    });
}

/** Texte brut (IA, résumés, extraction pour le référencement). */
export function htmlToText(html: string | undefined): string {
  return (html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
