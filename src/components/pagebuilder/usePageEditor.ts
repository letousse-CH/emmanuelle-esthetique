import { useCallback, useRef, useState } from 'react';
import type { PageSection, SectionData, SectionType } from './wireframes.config';

export const SECTION_DEFAULTS: Record<string, Record<string, unknown>> = {
  hero_1:        { title: 'Nouveau titre', description: 'Description…' },
  hero_2:        { title: 'Nouveau titre' },
  hero_3:        { title: 'Votre titre', title_italic: 'ici', description: '', items: ['Première prestation', 'Deuxième prestation', 'Troisième prestation'], cta_primary_text: 'Réserver', cta_primary_href: '/contact', image_url: '' },
  hero_4:        { title: 'Votre titre', title_italic: 'ici', description: '', card_title: 'Sur rendez-vous', card_text: '', cta_text: 'Prendre rendez-vous', cta_href: '/contact', image_url: '' },
  hero_5:        { eyebrow: 'Nos soins', title: 'Titre de la page', description: 'Une phrase d\'introduction courte.', align: 'center' },
  intro_1:       { quote: '« Notre savoir-faire au service de votre bien-être. »', text: 'Découvrez notre histoire et notre engagement au quotidien.', cta_text: 'En savoir plus', cta_href: '/contact' },
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
  marquee_1: { items: ['Première prestation', 'Deuxième prestation', 'Troisième prestation'], bg_color: '#0f0e0d', text_color: '#d4b483', separator: '★', speed: 'normal' },
  pricing_1: { title: 'Notre offre', price: '895 €', price_note: 'paiement en plusieurs fois possible', badge: 'Programme 3 mois', items: ['Inclus 1', 'Inclus 2'], cta_text: 'Réserver', cta_href: '#' },
  // Avis : emplacements vides volontairement — à remplir avec de vrais
  // témoignages depuis l'éditeur. Ne pas pré-remplir avec des avis fictifs.
  reviews_1: { title: 'Ce que disent', title_bold: 'nos clientes', description: 'Remplacez ces emplacements par de vrais témoignages.', cta_text: '', cta_href: '#', cards: [{ name: 'Avis à remplacer', date: '—', rating: 5, text: 'Emplacement réservé à un témoignage authentique. Modifiez ce texte depuis l\'éditeur.' }, { name: 'Avis à remplacer', date: '—', rating: 5, text: 'Emplacement réservé à un témoignage authentique. Modifiez ce texte depuis l\'éditeur.' }, { name: 'Avis à remplacer', date: '—', rating: 5, text: 'Emplacement réservé à un témoignage authentique. Modifiez ce texte depuis l\'éditeur.' }] },
  stats_1: { title: 'Des résultats concrets', cards: [{ value: '500+', label: 'Personnes accompagnées' }, { value: '98%', label: 'Taux de satisfaction' }, { value: '10 ans', label: "D'expérience clinique" }] },
  timeline_1: { title: 'Comment ça se passe', cards: [{ title: 'Premier échange', description: 'Un appel gratuit pour comprendre votre situation.' }, { title: 'Diagnostic', description: 'On pose des mots sur ce que vous vivez.' }, { title: 'Plan d\'action', description: 'Une feuille de route claire et personnalisée.' }] },
  cta_2:         { title: 'Prêt à commencer ?', description: 'Une phrase qui lève la dernière hésitation.', cta_text: 'Nous contacter', cta_href: '/contact' },
  cta_3:         { title: 'Une question ?', description: 'Nous répondons sous 24 h ouvrées.', cta_text: 'Écrivez-nous', cta_href: '/contact' },
  testimonial_2: { title: 'Ce qu\'on dit de nous', cards: [{ quote: 'Emplacement à remplacer par un vrai témoignage.', author: 'Nom', role: 'Fonction' }, { quote: 'Emplacement à remplacer par un vrai témoignage.', author: 'Nom', role: 'Fonction' }, { quote: 'Emplacement à remplacer par un vrai témoignage.', author: 'Nom', role: 'Fonction' }] },
  team_1:        { title: 'L\'équipe', description: '', cards: [{ name: 'Prénom Nom', role: 'Fonction', image: '', bio: '' }, { name: 'Prénom Nom', role: 'Fonction', image: '', bio: '' }, { name: 'Prénom Nom', role: 'Fonction', image: '', bio: '' }] },
  contact_1:     { title: 'Nous joindre', description: '', address: 'Rue et numéro, code postal, ville', phone: '', email: '', hours: 'Du lundi au vendredi, 9h – 18h' },
  steps_1:       { title: 'Comment ça se passe', cards: [{ title: 'Premier contact', description: '' }, { title: 'Proposition', description: '' }, { title: 'Réalisation', description: '' }, { title: 'Suivi', description: '' }] },
  stats_2:       { cards: [{ value: '10 ans', label: 'D\'expérience' }, { value: '250', label: 'Clients accompagnés' }, { value: '48 h', label: 'Délai de réponse' }, { value: '100 %', label: 'Sur-mesure' }] },
  faq_2:         { title: 'Questions fréquentes', cards: [{ question: 'Première question ?', answer: 'Réponse.' }, { question: 'Deuxième question ?', answer: 'Réponse.' }, { question: 'Troisième question ?', answer: 'Réponse.' }, { question: 'Quatrième question ?', answer: 'Réponse.' }] },
  compare_1:     { title: 'Pourquoi nous choisir', left_label: 'Ailleurs', right_label: 'Chez nous', rows: [{ label: 'Premier critère', left: false, right: true }, { label: 'Deuxième critère', left: false, right: true }, { label: 'Troisième critère', left: true, right: true }] },
  banner_1:      { text: 'Information ou promotion à afficher ici.', cta_text: 'En savoir plus', cta_href: '#' },
  logos_1: { eyebrow: 'Ils en parlent', cards: Array.from({ length: 4 }, () => ({ image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><rect width='120' height='40' rx='6' fill='%23d6d3d1'/><text x='60' y='25' font-family='sans-serif' font-size='12' fill='%2378716c' text-anchor='middle'>LOGO</text></svg>", alt: 'Logo' })) },
  hero_video:    { eyebrow: 'Découvrir en vidéo', title: 'Présentation vidéo de notre offre', description: 'Découvrez en 2 minutes comment nous vous accompagnons.', cta_text: 'Démarrer', cta_href: '#', video_poster: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80', trust_text: 'Rejoint par plus de 500 professionnels' },
  pricing_2:     { eyebrow: 'Tarifs simples', title: 'Choisissez la formule adaptée', description: 'Des offres claires, sans engagement.', yearly_discount_badge: '-20%', plans: [{ name: 'Essentiel', price_monthly: '29 €', price_yearly: '24 €', period: '/mois', description: 'Idéal pour démarrer', popular: false, features: ['Accès complet', 'Support 7j/7'], cta_text: 'Choisir' }, { name: 'Pro', price_monthly: '59 €', price_yearly: '47 €', period: '/mois', description: 'Pour accélérer', badge: 'Populaire', popular: true, features: ['Tout de Essentiel', 'Accompagnement dédié', 'Mises à jour prioritaires'], cta_text: 'Essayer Pro' }, { name: 'Sur-Mesure', price_monthly: '99 €', price_yearly: '79 €', period: '/mois', description: 'Pour les grands projets', popular: false, features: ['Projet dédié', 'Garantie de réponse 2h'], cta_text: 'Nous contacter' }] },
  stats_3:       { title: 'Métriques clés', description: 'Des résultats concrets et vérifiés', cards: [{ metric: '99%', label: 'Satisfaction client', sublabel: 'Sur +500 avis' }, { metric: '+12K', label: 'Projets livrés', sublabel: 'En 5 ans', highlight: true }, { metric: '24/7', label: 'Support réactif', sublabel: 'Assistance dédiée' }, { metric: '4.9/5', label: 'Note moyenne', sublabel: 'Sur Trustpilot' }] },
  newsletter_1:  { eyebrow: 'Newsletter', title: 'Restez informé de nos nouveautés', description: 'Recevez nos conseils exclusifs directement dans votre boîte mail.', placeholder: 'Votre adresse e-mail...', button_text: 'S’inscrire', privacy_note: 'Désinscription en 1 clic. Pas de spam.' },
  bento_grid_1:  { eyebrow: 'Fonctionnalités', title: 'Tout ce dont vous avez besoin', description: 'Une suite moderne conçue pour la performance.', cards: [{ title: 'Interface Intuitive', description: 'Prise en main immédiate.', tag: 'Performance', metric: '10x', image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80' }, { title: 'Sécurité Maximale', description: 'Données chiffrées.', tag: 'Sécurité' }, { title: 'Collaboration Fluide', description: 'Travaillez en équipe sans friction.', tag: 'Équipe' }, { title: 'Analytics en Direct', description: 'Suivez vos indicateurs en temps réel.', tag: 'Statistiques', metric: '100%', image_url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80' }] },
  blog_grid_1:   { eyebrow: 'Actualités & Articles', title: 'Dernières publications', description: 'Découvrez nos derniers conseils et analyses.', limit: 3 },
  hero_split_badge: { eyebrow: 'Nouveauté', title: 'Découvrez notre nouvelle offre', description: 'Une solution complète conçue pour accélérer votre activité.', cta_text: 'Démarrer maintenant', cta_href: '/contact', image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80' },
  features_grid_offset: { title: 'Pourquoi nous faire confiance', description: 'Des engagements forts et mesurables au quotidien.', cards: [{ title: 'Réactivité 24/7', description: 'Une équipe toujours disponible pour vous répondre.' }, { title: 'Qualité Garantie', description: 'Aucune concession sur la rigueur et le résultat.' }, { title: 'Sécurité Chiffrée', description: 'Vos données protégées selon les normes bancaires.' }, { title: 'Transparence Totale', description: 'Des tarifs clairs et sans mauvaise surprise.' }] },
  pricing_cards_modern: { eyebrow: 'Tarification', title: 'Nos formules d\'accompagnement', description: 'Sélectionnez l\'offre qui correspond exactement à vos besoins.', plans: [{ name: 'Essentiel', price: '490 €', period: 'formule unique', description: 'Pour démarrer sereinement', features: ['Diagnostic complet', 'Feuille de route 30 jours', 'Support par e-mail'], cta_text: 'Choisir Essentiel', cta_href: '/contact' }, { name: 'Pro', price: '990 €', period: 'formule complète', badge: 'Populaire', description: 'Pour accélérer vos résultats', features: ['Tout de Essentiel', 'Accompagnement hebdomadaire', 'Accès prioritaire 7j/7'], cta_text: 'Choisir Pro', cta_href: '/contact' }] },
  faq_accordion_modern: { eyebrow: 'FAQ', title: 'Questions fréquemment posées', description: 'Retrouvez les réponses aux interrogations les plus courantes.', cards: [{ question: 'Comment se déroule le premier échange ?', answer: 'Le premier échange dure 30 minutes. C\'est un entretien gratuit et sans engagement pour faire le point sur vos attentes.' }, { question: 'Quels sont les délais de mise en œuvre ?', answer: 'En général, les premiers résultats sont visibles dès les deux premières semaines d\'accompagnement.' }] },
  hero_turnkey_voice: { eyebrow: 'Assistant Vocal & IA', title: 'Votre site web nouvelle génération', description: 'Générez et modifiez vos pages à la voix ou avec l\'assistant IA.', cta_text: 'Tester l\'assistant IA', cta_href: '#ai' },
  client_needs_matrix: { title: 'À chaque besoin, sa solution', description: 'Découvrez nos réponses concrètes à vos enjeux.', cards: [{ need: 'Besoin de visibilité', solution: 'Un site optimisé pour le référencement naturel Google.' }, { need: 'Besoin d\'automatiser', solution: 'Prise de rendez-vous et paiement en ligne automatisés.' }] },
  voice_showcase_1: { title: 'Pilotage par l\'Intelligence Artificielle', description: 'Administrez votre activité sans toucher au code.', cta_text: 'Découvrir', cta_href: '#demo' },
  admin_mockups_gallery: { title: 'Une interface d\'administration puissante', description: 'Gérez votre flotte et vos contenus en toute simplicité.' },
  turnkey_bento_grid: { eyebrow: 'Écosystème', title: 'Un environnement d\'outils intégrés', description: 'Tout est réuni au même endroit pour votre succès.' },
  turnkey_offer_pricing: { title: 'Notre offre tout-en-un', price: '895 €', price_note: 'Paiement en 3x disponible', cta_text: 'Réserver mon offre', cta_href: '/contact' },
  turnkey_faq_accordion: { title: 'Questions & Réponses', cards: [{ question: 'Puis-je modifier mes contenus moi-même ?', answer: 'Oui, vous disposez d\'un accès d\'administration complet pour éditer vos textes, images et offres à tout moment.' }] },
  turnkey_steps_1: { title: 'Votre parcours en 4 étapes', cards: [{ title: '1. Analyse', description: 'Compréhension de vos objectifs.' }, { title: '2. Configuration', description: 'Mise en place de l\'espace.' }, { title: '3. Lancement', description: 'Publication de votre site.' }, { title: '4. Suivi', description: 'Accompagnement continu.' }] },
  turnkey_testimonials_1: { title: 'Retours de nos clients', cards: [{ quote: 'Un gain de temps incroyable et un résultat très professionnel.', author: 'Sophie M.' }] },
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

  const redoRef = useRef<PageSection[][]>([]);
  const [redoLen, setRedoLen] = useState(0);
  const setRedo = useCallback((next: PageSection[][]) => {
    redoRef.current = next;
    setRedoLen(next.length);
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
    setRedo([]);
    setDirty(true);
  }, [setHistory, setRedo]);

  /** Remplace le contenu sans polluer l'historique (chargement d'une page). */
  const reset = useCallback((next: PageSection[]) => {
    sectionsRef.current = next;
    setSectionsState(next);
    setHistory([]);
    setRedo([]);
    setDirty(false);
    lastEdit.current = { key: '', at: 0 };
  }, [setHistory, setRedo]);

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
    const current = sectionsRef.current;
    historyRef.current = h.slice(0, -1);
    sectionsRef.current = previous;
    setSectionsState(previous);
    setHistory(historyRef.current);
    setRedo([...redoRef.current, current]);
    setDirty(true);
    lastEdit.current = { key: '', at: 0 };
  }, [setHistory, setRedo]);

  const redo = useCallback(() => {
    const r = redoRef.current;
    if (r.length === 0) return;
    const next = r[r.length - 1];
    const current = sectionsRef.current;
    redoRef.current = r.slice(0, -1);
    sectionsRef.current = next;
    setSectionsState(next);
    setRedo(redoRef.current);
    setHistory([...historyRef.current, current]);
    setDirty(true);
    lastEdit.current = { key: '', at: 0 };
  }, [setHistory, setRedo]);

  const markClean = useCallback(() => setDirty(false), []);

  /**
   * Bascule le type d'une section tout en préservant le contenu utilisateur
   * (titres, sous-titres, descriptions, images, boutons et cartes).
   */
  const swapType = useCallback((i: number, newType: SectionType) => {
    commit((prev) => {
      if (!prev[i] || prev[i].type === newType) return prev;
      const oldSection = prev[i];
      const oldData = (oldSection.data || {}) as Record<string, unknown>;
      const newDefaults = JSON.parse(JSON.stringify(SECTION_DEFAULTS[newType] ?? {})) as Record<string, unknown>;

      const newData: Record<string, unknown> = {
        ...newDefaults,
        ...oldData,
      };

      if (oldData.cta_primary_text && !newData.cta_text) {
        newData.cta_text = oldData.cta_primary_text;
      }
      if (oldData.cta_primary_href && !newData.cta_href) {
        newData.cta_href = oldData.cta_primary_href;
      }
      if (oldData.cta_text && !newData.cta_primary_text) {
        newData.cta_primary_text = oldData.cta_text;
      }
      if (oldData.cta_href && !newData.cta_primary_href) {
        newData.cta_primary_href = oldData.cta_href;
      }

      if (oldData.quote && !newData.description) {
        newData.description = oldData.quote;
      }
      if (oldData.description && !newData.quote) {
        newData.quote = oldData.description;
      }
      if (typeof oldData.content === 'string' && oldData.content.trim() && !newData.description) {
        newData.description = oldData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (typeof oldData.description === 'string' && oldData.description.trim() && !newData.content) {
        newData.content = `<p>${oldData.description}</p>`;
      }

      if (oldData.image_url && !newData.image) {
        newData.image = oldData.image_url;
      }
      if (oldData.image && !newData.image_url) {
        newData.image_url = oldData.image;
      }

      if (Array.isArray(oldData.cards) && oldData.cards.length > 0) {
        newData.cards = oldData.cards;
      }
      if (Array.isArray(oldData.items) && oldData.items.length > 0) {
        newData.items = oldData.items;
      }

      return prev.map((s, idx) =>
        idx === i ? { ...s, type: newType, data: newData as SectionData } : s
      );
    });
  }, [commit]);

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
    swapType,
    updateField,
    undo,
    redo,
    canUndo: historyLen > 0,
    canRedo: redoLen > 0,
    dirty,
    markClean,
  };
}
