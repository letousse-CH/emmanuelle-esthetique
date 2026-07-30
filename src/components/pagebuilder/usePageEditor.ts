import { useCallback, useRef, useState } from 'react';
import type { PageSection, SectionData, SectionType } from './wireframes.config';

export const SECTION_DEFAULTS: Record<SectionType, Record<string, unknown>> = {
  hero_1:        { title: 'Nouveau titre', description: 'Description…' },
  hero_2:        { title: 'Nouveau titre' },
  hero_3:        { title: 'Prendre soin de vous', title_italic: 'chez vous', description: 'Une parenthèse de bien-être, à domicile.', items: ['Soins du visage', 'Head Spa', 'Massages'], cta_primary_text: 'Réserver', cta_primary_href: '/contact', image_url: '' },
  hero_4:        { title: 'Le bien-être', title_italic: 'à votre porte', description: 'Soins du visage, Head Spa et massages relaxants à domicile.', card_title: 'Sur rendez-vous', card_text: 'Palézieux et environs, du lundi au samedi.', cta_text: 'Prendre rendez-vous', cta_href: '/contact', image_url: '' },
  hero_5:        { eyebrow: 'Nos soins', title: 'Titre de la page', description: 'Une phrase d\'introduction courte.', align: 'center' },
  intro_1:       { quote: 'Citation…', text: 'Texte de présentation…' },
  features_1:    { title: 'Points clés', items: ['Point 1', 'Point 2'] },
  features_2:    { title: 'Nos atouts', cards: [{ title: 'Atout 1', description: '…' }, { title: 'Atout 2', description: '…' }, { title: 'Atout 3', description: '…' }] },
  features_3:    { title: 'Nos offres', cards: [{ title: 'Offre 1', description: '…', items: ['Item 1'], cta_text: 'En savoir plus' }, { title: 'Offre 2', description: '…', items: ['Item 1'], cta_text: 'En savoir plus' }] },
  cta_1:         { title: 'Prêt à commencer ?', cta_text: 'Nous contacter' },
  testimonial_1: { quote: 'Témoignage client…', author: 'Prénom N.' },
  text_1:        { content: 'Texte libre…' },
  text_image_1:  { title: 'Titre de la section', content: '<p>Votre texte ici. Utilisez la barre d\'outils pour ajouter des <strong>liens</strong>, des titres ou des listes.</p>', image_position: 'left', ratio: 'half', image_width: 100 },
  gallery_grid:  { title: 'Galerie d\'images', description: 'Description…', cards: [{ title: 'Image 1', description: '…', image: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=800' }] },
  gallery_carousel: { title: 'Carrousel d\'images', description: 'Défilement horizontal…', cards: [{ title: 'Image 1', description: '…', image: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=800' }] },
  gallery_masonry: { title: 'Galerie en Cascade', description: 'Style Pinterest…', cards: [{ title: 'Image 1', description: '…', image: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=800' }] },
  faq_1:  { title: 'Foire Aux Questions', cards: [{ question: 'Question 1 ?', answer: 'Réponse 1…' }] },
  marquee_1: { items: ['Soins du visage', 'Head Spa', 'Massages relaxants', 'Beauté du regard'], bg_color: '#0f0e0d', text_color: '#d4b483', separator: '★', speed: 'normal' },
  pricing_1: { title: 'Notre offre', price: '895 €', price_note: 'paiement en plusieurs fois possible', badge: 'Programme 3 mois', items: ['Inclus 1', 'Inclus 2'], cta_text: 'Réserver', cta_href: '#' },
  // Avis : emplacements vides volontairement — à remplir avec de vrais
  // témoignages depuis l'éditeur. Ne pas pré-remplir avec des avis fictifs.
  reviews_1: { title: 'Ce que disent', title_bold: 'nos clientes', description: 'Remplacez ces emplacements par de vrais témoignages.', cta_text: '', cta_href: '#', cards: [{ name: 'Avis à remplacer', date: '—', rating: 5, text: 'Emplacement réservé à un témoignage authentique. Modifiez ce texte depuis l\'éditeur.' }, { name: 'Avis à remplacer', date: '—', rating: 5, text: 'Emplacement réservé à un témoignage authentique. Modifiez ce texte depuis l\'éditeur.' }, { name: 'Avis à remplacer', date: '—', rating: 5, text: 'Emplacement réservé à un témoignage authentique. Modifiez ce texte depuis l\'éditeur.' }] },
  stats_1: { title: 'Des résultats concrets', cards: [{ value: '500+', label: 'Personnes accompagnées' }, { value: '98%', label: 'Taux de satisfaction' }, { value: '10 ans', label: "D'expérience clinique" }] },
  timeline_1: { title: 'Comment ça se passe', cards: [{ title: 'Premier échange', description: 'Un appel gratuit pour comprendre votre situation.' }, { title: 'Diagnostic', description: 'On pose des mots sur ce que vous vivez.' }, { title: 'Plan d\'action', description: 'Une feuille de route claire et personnalisée.' }] },
  logos_1: { eyebrow: 'Ils en parlent', cards: Array.from({ length: 4 }, () => ({ image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><rect width='120' height='40' rx='6' fill='%23d6d3d1'/><text x='60' y='25' font-family='sans-serif' font-size='12' fill='%2378716c' text-anchor='middle'>LOGO</text></svg>", alt: 'Logo' })) },
};

/**
 * Découpe un chemin de champ en segments. Accepte indifféremment la notation
 * pointée et la notation crochets — les deux coexistent dans `sections.tsx`
 * (`cards.0.title`, `plans[0].badge`, `cards[1].items.2`).
 */
export function parseFieldPath(path: string): (string | number)[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s !== '')
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/**
 * Écrit `value` à `segs` en ne clonant que la branche traversée (le reste de
 * l'objet garde son identité, ce qui évite de recréer tout l'arbre React).
 */
function setAtPath<T>(source: T, segs: (string | number)[], value: unknown): T {
  if (segs.length === 0) return value as T;
  const [seg, ...rest] = segs;

  if (typeof seg === 'number') {
    const arr = Array.isArray(source) ? [...(source as unknown[])] : [];
    arr[seg] = setAtPath(arr[seg], rest, value);
    return arr as unknown as T;
  }

  const obj: Record<string, unknown> = { ...((source ?? {}) as Record<string, unknown>) };
  obj[seg] = setAtPath(obj[seg], rest, value);
  return obj as unknown as T;
}

const HISTORY_LIMIT = 50;
/** Deux frappes sur le même champ à moins de 700 ms ne créent qu'un point d'annulation. */
const COALESCE_MS = 700;

export function usePageEditor(initial: PageSection[]) {
  const [sections, setSectionsState] = useState<PageSection[]>(initial);
  const [dirty, setDirty] = useState(false);
  // L'historique vit dans une ref (lue et écrite de façon synchrone) ; seule sa
  // longueur est un état, pour que `canUndo` déclenche un rendu.
  const historyRef = useRef<PageSection[][]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const setHistory = useCallback((next: PageSection[][]) => {
    historyRef.current = next;
    setHistoryLen(next.length);
  }, []);

  // Miroir synchrone de l'état : `commit` doit rester une fonction pure (pas
  // d'effet dans un updater `setState`, React le rejoue en mode strict).
  const sectionsRef = useRef<PageSection[]>(initial);
  // Coalescence des points d'annulation : évite un « undo » par caractère tapé.
  const lastEdit = useRef<{ key: string; at: number }>({ key: '', at: 0 });

  const commit = useCallback((updater: (prev: PageSection[]) => PageSection[], coalesceKey?: string) => {
    const prev = sectionsRef.current;
    const next = updater(prev);
    if (next === prev) return;

    const now = Date.now();
    const shouldCoalesce =
      !!coalesceKey &&
      coalesceKey === lastEdit.current.key &&
      now - lastEdit.current.at < COALESCE_MS;
    lastEdit.current = { key: coalesceKey ?? '', at: now };

    sectionsRef.current = next;
    setSectionsState(next);
    if (!shouldCoalesce) {
      setHistory([...historyRef.current.slice(-(HISTORY_LIMIT - 1)), prev]);
    }
    setDirty(true);
  }, [setHistory]);

  /** Remplace le contenu sans polluer l'historique (chargement d'une page). */
  const reset = useCallback((next: PageSection[]) => {
    sectionsRef.current = next;
    setSectionsState(next);
    setHistory([]);
    setDirty(false);
    lastEdit.current = { key: '', at: 0 };
  }, [setHistory]);

  /** Remplace le contenu comme une action utilisateur annulable (génération IA). */
  const replaceAll = useCallback((next: PageSection[]) => {
    commit(() => next);
  }, [commit]);

  const move = useCallback((i: number, dir: -1 | 1) => {
    commit((prev) => {
      const j = i + dir;
      if (i < 0 || j < 0 || i >= prev.length || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, [commit]);

  /** Déplacement libre (glisser-déposer) : sort l'élément puis l'insère à `to`. */
  const moveTo = useCallback((from: number, to: number) => {
    commit((prev) => {
      if (from === to || from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, [commit]);

  const remove = useCallback((i: number) => {
    commit((prev) => prev.filter((_, idx) => idx !== i));
  }, [commit]);

  const duplicate = useCallback((i: number) => {
    commit((prev) => {
      if (!prev[i]) return prev;
      const copy = JSON.parse(JSON.stringify(prev[i])) as PageSection;
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  }, [commit]);

  const add = useCallback((type: SectionType, at?: number) => {
    commit((prev) => {
      const section: PageSection = {
        type,
        data: JSON.parse(JSON.stringify(SECTION_DEFAULTS[type] ?? {})) as SectionData,
      };
      if (at === undefined || at < 0 || at > prev.length) return [...prev, section];
      return [...prev.slice(0, at), section, ...prev.slice(at)];
    });
  }, [commit]);

  /**
   * Met à jour un champ d'une section. `key` accepte un chemin complet :
   * `title`, `cards.0.title`, `cards[0].items.2`, `plans[1].price`.
   * L'ancienne implémentation ne gérait que `arr[0].champ` et écrivait une clé
   * plate (`data["cards.0.title"]`) pour tout le reste — les modifications en
   * ligne des cartes et des listes étaient donc silencieusement perdues.
   */
  const updateField = useCallback((i: number, key: string, value: unknown) => {
    const segs = parseFieldPath(key);
    if (segs.length === 0) return;
    commit(
      (prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, data: setAtPath(s.data, segs, value) } : s,
        ),
      `${i}:${key}`,
    );
  }, [commit]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.length === 0) return;
    const previous = h[h.length - 1];
    historyRef.current = h.slice(0, -1);
    sectionsRef.current = previous;
    setSectionsState(previous);
    setHistory(historyRef.current);
    setDirty(true);
    lastEdit.current = { key: '', at: 0 };
  }, [setHistory]);

  const markClean = useCallback(() => setDirty(false), []);

  return {
    sections,
    /** Chargement initial / externe — ne crée pas de point d'annulation. */
    setSections: reset,
    replaceAll,
    move,
    moveTo,
    remove,
    duplicate,
    add,
    updateField,
    undo,
    canUndo: historyLen > 0,
    dirty,
    markClean,
  };
}
