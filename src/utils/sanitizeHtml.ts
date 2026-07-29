import DOMPurify from 'dompurify';

// Nettoie le HTML produit par l'éditeur Quill avant enregistrement en base
// (défense en profondeur : ce contenu est ensuite injecté tel quel via
// dangerouslySetInnerHTML sur les pages publiques). Autorise les <iframe>
// uniquement pour les embeds vidéo YouTube, afin de ne pas casser cette
// fonctionnalité de l'éditeur.
export function sanitizeEditorHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return html;
  const purifier = typeof DOMPurify === 'function' ? (DOMPurify as any)(window) : DOMPurify;
  if (!purifier?.sanitize) return html;

  const stripUnsafeIframes = (node: any, data: any) => {
    if (data.tagName === 'iframe') {
      const src = node.getAttribute?.('src') || '';
      if (!/^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//.test(src)) {
        node.remove();
      }
    }
  };
  purifier.addHook('uponSanitizeElement', stripUnsafeIframes);
  const clean = purifier.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'class'],
  });
  purifier.removeHooks('uponSanitizeElement');
  return clean;
}
