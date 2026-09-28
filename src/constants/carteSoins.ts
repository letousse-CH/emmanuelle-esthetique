/**
 * Carte des soins & tarifs d'Emmanuelle Esthétique — source unique.
 *
 * Reprise mot pour mot de « CARTE DES SOINS & TARIFS » (septembre 2026). Elle
 * alimente les pages du site (script `seed-site-v2`), le catalogue Schema.org
 * du layout et `llms.txt` : changer un prix ici le change partout au prochain
 * déploiement. Les pages déjà enregistrées en base gardent, elles, leur texte —
 * elles se modifient dans le page builder.
 *
 * Règle : aucune durée, aucun prix, aucun nom de soin n'est inventé. Un champ
 * absent de la carte (ex. durée d'une teinture de cils) reste absent ici.
 */

export type CarteCategoryId = 'visage' | 'corps' | 'mains-pieds' | 'regard' | 'epilation';

export interface CarteVariant {
  /** ex. « 60 min » */
  duration: string;
  price: number;
}

export interface CarteItem {
  id: string;
  name: string;
  /** Durée annoncée, telle qu'écrite dans la carte (« 60 min », « 1h45 »). */
  duration?: string;
  /** Prix en CHF. Pour un soin à plusieurs durées, voir `variants`. */
  price: number;
  /** Plusieurs durées / plusieurs prix (le premier est le prix « dès »). */
  variants?: CarteVariant[];
  description?: string;
}

export interface CarteGroup {
  /** Titre de sous-groupe (« Les Privilèges Visage »), absent pour le groupe principal. */
  title?: string;
  intro?: string;
  items: CarteItem[];
}

export interface CarteCategory {
  id: CarteCategoryId;
  label: string;
  /** Chemin public de la page pilier du silo. */
  path: string;
  /** Phrase d'introduction de la carte. */
  tagline: string;
  groups: CarteGroup[];
}

export const CARTE: CarteCategory[] = [
  {
    id: 'visage',
    label: 'Soins du visage Phytomer',
    path: '/soins/visage',
    tagline: 'Protocoles marins de haute technicité associant manœuvres expertes, efficacité visible et lâcher-prise absolu.',
    groups: [
      {
        items: [
          {
            id: 'peau-nette-eclat-express',
            name: 'Soin Peau Nette & Coup d’Éclat Express',
            duration: '40 min',
            price: 90,
            description:
              'Nettoyage profond désincrustant sous serviettes chaudes, gommage marin enzymatique, masque chauffant détoxifiant et hydratation personnalisée. Idéal pour un coup d’éclat immédiat.',
          },
          {
            id: 'hydra-originel',
            name: 'Soin Hydra Originel — Désaltérant & Repulpant',
            duration: '60 min',
            price: 140,
            description:
              'Véritable bain d’hydratation aux algues tissées bio. Comprend un gommage velours, un modelage délassant du visage et du décolleté, et un masque crémeux à l’algue Nori. Repulpe les traits et restaure la barrière cutanée.',
          },
          {
            id: 'expert-jeunesse',
            name: 'Soin Expert Jeunesse — Correction Rides & Fermeté',
            duration: '75 min',
            price: 165,
            description:
              'Protocole anti-âge intensif. Modelage remodelant ciblé inspiré des techniques de digito-pression, suivi de la pose d’un masque plastifiant tenseur aux actifs marins purs. Lisse visiblement les rides installées et tonifie l’ovale du visage.',
          },
        ],
      },
      {
        title: 'Les Privilèges Visage',
        intro: 'En complément, pendant votre soin.',
        items: [
          {
            id: 'option-boue-marine-dos',
            name: 'Option Boue Marine Auto-Chauffante Dos',
            price: 30,
            description:
              'Application d’une boue marine effervescente et reminéralisante le long de la colonne vertébrale pendant votre soin du visage. Libère immédiatement les tensions musculaires du haut du corps.',
          },
          {
            id: 'option-cuir-chevelu-nuque',
            name: 'Option Massage Relaxant du Cuir Chevelu & Nuque',
            duration: '15 min',
            price: 25,
          },
        ],
      },
    ],
  },
  {
    id: 'corps',
    label: 'Rituels & massages du corps',
    path: '/soins/corps',
    tagline: 'La rencontre entre le magnétisme marin et une gestuelle manuelle précise, enveloppante et décontractante.',
    groups: [
      {
        items: [
          {
            id: 'voile-de-satin',
            name: 'Soin Voile de Satin — Gommage Peau Neuve',
            duration: '45 min',
            price: 110,
            description:
              'Exfoliation complète aux cristaux de sels marins reminéralisants, suivie d’une application onctueuse et massée de lait satinant. La peau est exfoliée, douce et veloutée.',
          },
          {
            id: 'bulles-des-mers',
            name: 'Soin Bulles des Mers — Détox & Pureté du Dos',
            duration: '45 min',
            price: 110,
            description:
              'Gommage purifiant du dos, pose sous occlusion thermique de boue marine auto-chauffante décontracturante, puis modelage délassant des trapèzes, de la nuque et du dos à l’huile végétale précieuse.',
          },
          {
            id: 'grand-massage-relaxant',
            name: 'Grand Massage Relaxant Marine — Signature Spa',
            duration: '60 min / 90 min',
            price: 145,
            variants: [
              { duration: '60 min', price: 145 },
              { duration: '90 min', price: 210 },
            ],
            description:
              'Massage complet du corps sur-mesure combinant effleurages profonds, drainages doux et pressions dénouantes à l’huile marine satinante parfum printanier. Adapté sur-mesure aux besoins musculaires et énergétiques du jour.',
          },
          {
            id: 'echappee-belle',
            name: 'Rituel Échappée Belle — Visage & Corps',
            duration: '1h45',
            price: 230,
            description:
              'La synergie parfaite : le gommage complet du corps Voile de Satin ou un massage ciblé du dos, immédiatement suivi du Soin Hydra Originel complet.',
          },
        ],
      },
    ],
  },
  {
    id: 'mains-pieds',
    label: 'Beauté des mains & des pieds',
    path: '/soins/mains-et-pieds',
    tagline:
      'Des rituels complets alliant technicité ongulaire, exfoliation et relaxation profonde. La mise en beauté de l’ongle est naturellement intégrée au protocole.',
    groups: [
      {
        items: [
          {
            id: 'prestige-mains',
            name: 'Soin Prestige des Mains « Spa »',
            duration: '60 min',
            price: 85,
            description:
              'Limage sur-mesure, travail précis des cuticules, gommage aux sels fins marins, masque régénérant tiède et modelage décontractant de l’avant-bras et de la main.',
          },
          {
            id: 'prestige-pieds',
            name: 'Soin Prestige des Pieds « Spa »',
            duration: '70 min',
            price: 105,
            description:
              'Élimination des callosités, mise en forme de l’ongle, soin des cuticules, gommage exfoliant en profondeur, masque adoucissant sous serviettes chaudes et modelage défatigant de la voûte plantaire et des mollets.',
          },
        ],
      },
    ],
  },
  {
    id: 'regard',
    label: 'Beauté du regard',
    path: '/soins/regard',
    tagline: 'Mise en valeur naturelle de la ligne du sourcil et de la profondeur du regard.',
    groups: [
      {
        items: [
          { id: 'teinture-cils', name: 'Teinture des cils', price: 30 },
          { id: 'teinture-sourcils', name: 'Teinture des sourcils', price: 22 },
          { id: 'duo-regard', name: 'Duo Regard (teinture cils + teinture sourcils)', price: 45 },
          { id: 'rehaussement-cils', name: 'Réhaussement de cils', price: 100 },
        ],
      },
    ],
  },
  {
    id: 'epilation',
    label: 'Épilation à la cire douce & à la pâte de sucre',
    path: '/soins/epilation',
    tagline:
      'Épilations soignées, hygiéniques et confortables avec des cires douces de haute qualité adaptées aux peaux sensibles, suivies d’une application d’émulsion apaisante marine.',
    groups: [
      {
        items: [
          { id: 'epil-sourcils', name: 'Sourcils', price: 22 },
          { id: 'epil-levre', name: 'Lèvre supérieure', price: 15 },
          { id: 'epil-visage', name: 'Visage complet (sourcils, lèvre, menton, joues)', price: 45 },
          { id: 'epil-aisselles', name: 'Aisselles', price: 22 },
          { id: 'epil-bras', name: 'Bras', price: 40 },
          { id: 'epil-demi-jambes', name: 'Demi-jambes', price: 42 },
          { id: 'epil-jambes', name: 'Jambes complètes', price: 68 },
          { id: 'epil-maillot-classique', name: 'Maillot classique', price: 28 },
          { id: 'epil-maillot-integral', name: 'Maillot échancré ou intégral (au sucre)', price: 55 },
        ],
      },
      {
        title: 'Les Forfaits Signature',
        intro: 'Simples et tout compris.',
        items: [
          {
            id: 'forfait-douceur',
            name: 'Forfait Douceur',
            price: 95,
            description:
              'Demi-jambes + aisselles + maillot au choix. Formule essentielle rapide et nette, quel que soit le type de maillot souhaité.',
          },
          {
            id: 'forfait-integral',
            name: 'Forfait Intégral',
            price: 125,
            description:
              'Jambes complètes + aisselles + maillot au choix. Le rituel complet corps sans compromis, quel que soit le type de maillot souhaité.',
          },
        ],
      },
    ],
  },
];

export const EPILATION_SUCRE_TEXT =
  'Réalisée à la pâte de sucre 100 % naturelle selon un savoir-faire traditionnel précis, l’épilation orientale offre une extraction du poil d’une douceur incomparable, réduisant visiblement les repousses sous peau tout en laissant l’épiderme souple et parfaitement satiné.';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** « CHF 90 » — convention suisse du site (voir CLAUDE.md, formatage des montants). */
export function chf(price: number): string {
  return `CHF ${price}`;
}

/** Prix affiché d'un soin : « CHF 145 / CHF 210 » quand il existe plusieurs durées. */
export function itemPriceLabel(item: CarteItem): string {
  return item.variants?.length ? item.variants.map((v) => chf(v.price)).join(' / ') : chf(item.price);
}

export function getCategory(id: CarteCategoryId): CarteCategory {
  const c = CARTE.find((x) => x.id === id);
  if (!c) throw new Error(`Catégorie de carte inconnue : ${id}`);
  return c;
}

export function getItem(id: string): CarteItem {
  for (const c of CARTE) for (const g of c.groups) for (const i of g.items) if (i.id === id) return i;
  throw new Error(`Soin inconnu dans la carte : ${id}`);
}

/** Tous les soins à plat, avec leur catégorie — pour le JSON-LD et llms.txt. */
export function flatCarte(): Array<CarteItem & { category: CarteCategory }> {
  return CARTE.flatMap((category) => category.groups.flatMap((g) => g.items.map((item) => ({ ...item, category }))));
}

export function priceRange(): { min: number; max: number } {
  const prices = flatCarte().flatMap((i) => (i.variants?.length ? i.variants.map((v) => v.price) : [i.price]));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
