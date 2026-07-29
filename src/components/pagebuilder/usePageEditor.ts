import { useState } from 'react';
import type { PageSection, SectionType } from './wireframes.config';

export const SECTION_DEFAULTS: Record<SectionType, Record<string, unknown>> = {
  hero_1:        { title: 'Nouveau titre', description: 'Description…' },
  hero_2:        { title: 'Nouveau titre' },
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

export function usePageEditor(initial: PageSection[]) {
  const [sections, setSections] = useState<PageSection[]>(initial);

  const move = (i: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  };

  const remove = (i: number) => {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  };

  const add = (type: SectionType) => {
    setSections((prev) => [...prev, { type, data: (SECTION_DEFAULTS[type] ?? {}) as unknown as import('./wireframes.config').SectionData }]);
  };

  const updateField = (i: number, key: string, value: unknown) => {
    setSections((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        if (key.includes('[')) {
          const newData = JSON.parse(JSON.stringify(s.data)) as unknown as Record<string, unknown>;
          const match = key.match(/^(\w+)\[(\d+)\]\.(.+)$/);
          if (match) {
            const [, arr, idxStr, field] = match;
            (newData[arr] as Record<string, unknown>[])[Number(idxStr)][field] = value;
          }
          return { ...s, data: newData as unknown as import('./wireframes.config').SectionData };
        }
        return { ...s, data: { ...(s.data as unknown as Record<string, unknown>), [key]: value } as unknown as import('./wireframes.config').SectionData };
      })
    );
  };

  return { sections, setSections, move, remove, add, updateField };
}
