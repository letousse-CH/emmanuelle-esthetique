/**
 * Seeder SEO local & GEO — Emmanuelle Esthétique
 *
 * Contient l'arborescence complète pensée pour un référencement local
 * dominant sur Palézieux-Gare, Palézieux-Village, Oron, Châtel-St-Denis
 * et la Haute-Broye, ainsi qu'une lisibilité maximale pour les moteurs IA
 * (ChatGPT, Perplexity, Google AI Overviews) : réponses factuelles courtes,
 * FAQ conversationnelle, entités claires (ville, gare, canton).
 *
 * Convention slugs : SLUGS PLATS (ex. `soin-anti-age-palezieux`). Le router
 * dynamique Next.js du template est mono-segment (`[slug]`). L'architecture
 * en silos est portée par les liens internes et les catégories, pas par la
 * profondeur d'URL — recommandation Google explicite.
 *
 * Sécurité : ce fichier n'écrit rien tout seul. Les fonctions sont invoquées
 * depuis un contexte authentifié (button "Peupler pages SEO" dans
 * /admin/pages, ou script `scripts/seed-seo.mjs` avec service_role).
 */

import { supabase } from './supabase';
import type { PageSection } from '../components/pagebuilder/wireframes.config';

export interface SeoPageSeed {
  title: string;
  slug: string;
  sections: PageSection[];
  published: boolean;
  /** Métadonnées SEO poussées dans `settings` (seo_pages_{slug}_*) */
  seo: {
    title: string;         // <=60 chars
    description: string;   // <=155 chars
    og_title?: string;
    og_description?: string;
    keywords?: string;
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS — pour raccourcir la déclaration des pages sans dupliquer les
   structures de section.
   ────────────────────────────────────────────────────────────────────────*/

const RESA_HREF = '/contact';
const PHONE = '+41 78 823 66 12'; // À AJUSTER si le vrai n° est différent
const CITY_TAG = 'Palézieux-Gare · Vaud';

// Palette (issue des settings existants)
const CREME = '#FAF7F2';
const SAGE_BG = '#F1EAE0';
const TURQUOISE = '#60B9C2';

const IMG_VISAGE = 'https://images.pexels.com/photos/5659016/pexels-photo-5659016.jpeg';
const IMG_MASSAGE_TETE = 'https://images.pexels.com/photos/6663371/pexels-photo-6663371.jpeg';
const IMG_MASSAGE = 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg';
const IMG_REGARD = 'https://images.pexels.com/photos/6954214/pexels-photo-6954214.jpeg';
const IMG_ANTIAGE = 'https://images.pexels.com/photos/5659020/pexels-photo-5659020.jpeg';
const IMG_EPILATION = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev/1789998853978-e-pilation.jpg';
const IMG_COCON = 'https://images.pexels.com/photos/3865800/pexels-photo-3865800.jpeg';
const IMG_ACCUEIL = 'https://images.pexels.com/photos/8633977/pexels-photo-8633977.jpeg';
const IMG_ATELIER = 'https://images.pexels.com/photos/6621462/pexels-photo-6621462.jpeg';

/* ── Imagerie marine ────────────────────────────────────────────────────────
   Rappel de la matière première des soins Phytomer utilisés à l'institut :
   eau de mer, écume, sable minéral et brume marine. Ces visuels servent aux
   arrière-plans de section CTA / hero / bandeau et restent modifiables depuis
   le constructeur (chaque section a son bouton « Image de fond »).
   ────────────────────────────────────────────────────────────────────────── */
export const IMG_MARINE_MER      = 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg';   // mer d'un bleu profond
export const IMG_MARINE_ECUME    = 'https://images.pexels.com/photos/462162/pexels-photo-462162.jpeg';     // écume sur rocher
export const IMG_MARINE_GALETS   = 'https://images.pexels.com/photos/289998/pexels-photo-289998.jpeg';     // galets minéraux
export const IMG_MARINE_BRUME    = 'https://images.pexels.com/photos/1123262/pexels-photo-1123262.jpeg';   // brume marine
export const IMG_MARINE_HORIZON  = 'https://images.pexels.com/photos/533923/pexels-photo-533923.jpeg';     // ligne d'horizon
export const IMG_MARINE_GOUTTES  = 'https://images.pexels.com/photos/1231622/pexels-photo-1231622.jpeg';   // gouttes d'eau
export const IMG_MARINE_LITTORAL = 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg';   // rochers granitiques

function hero(opts: {
  eyebrow?: string;
  title: string;
  description: string;
  cta?: string;
  ctaHref?: string;
  image?: string;
  themeDark?: boolean;
  bgColor?: string;
}): PageSection {
  return {
    type: 'hero_2',
    data: {
      theme: opts.themeDark ? 'dark' : 'light',
      eyebrow: opts.eyebrow || CITY_TAG,
      title: opts.title,
      description: opts.description,
      cta_text: opts.cta || 'Réserver ce soin',
      cta_href: opts.ctaHref || RESA_HREF,
      button_style: 'primary',
      bg_image: opts.image || '',
      bg_image_opacity: opts.image ? 60 : 100,
      bg_image_position: 'center',
      bg_color: opts.bgColor || '',
    },
  };
}

function introGeo(opts: {
  eyebrow?: string;
  quote: string;
  text: string;
  image?: string;
  imagePosition?: 'left' | 'right';
  bgColor?: string;
}): PageSection {
  return {
    type: 'intro_1',
    data: {
      theme: 'light',
      eyebrow: opts.eyebrow || 'En bref',
      quote: opts.quote,
      text: opts.text,
      image_url: opts.image || IMG_COCON,
      image_alt: opts.eyebrow || 'Institut Emmanuelle Esthétique à Palézieux-Gare',
      image_position: opts.imagePosition || 'right',
      bg_color: opts.bgColor || '',
      cta_text: '',
      cta_href: '',
    },
  };
}

function protocole(opts: {
  title: string;
  cards: Array<{ title: string; description: string }>;
  bgColor?: string;
}): PageSection {
  return {
    type: 'steps_1',
    data: {
      theme: 'light',
      title: opts.title,
      bg_color: opts.bgColor || CREME,
      cards: opts.cards,
    },
  };
}

function tarifBloc(opts: {
  title: string;
  price: string;
  priceNote?: string;
  items: string[];
  cta?: string;
  bgColor?: string;
}): PageSection {
  return {
    type: 'pricing_1',
    data: {
      theme: 'light',
      eyebrow: 'Tarif indicatif',
      title: opts.title,
      description:
        'Le tarif définitif est confirmé au moment de la prise de rendez-vous, en fonction de la formule choisie et de la durée réelle du soin.',
      badge: '',
      price: opts.price,
      price_note: opts.priceNote || '',
      items: opts.items,
      cta_text: opts.cta || 'Prendre rendez-vous',
      cta_href: RESA_HREF,
      button_style: 'primary',
      footnote:
        'Paiement en cabine (TWINT, espèces, cartes acceptées) — Bon cadeau accepté.',
      bg_color: opts.bgColor || '',
    },
  };
}

function faqLocale(opts: {
  title?: string;
  cards: Array<{ question: string; answer: string }>;
  bgColor?: string;
}): PageSection {
  return {
    type: 'faq_1',
    data: {
      theme: 'light',
      title: opts.title || 'Questions fréquentes',
      eyebrow: 'FAQ — soins à Palézieux',
      bg_color: opts.bgColor || '#FFFFFF',
      cards: opts.cards,
    },
  };
}

function ctaFinal(opts: {
  title?: string;
  description?: string;
  bgColor?: string;
  bgImage?: string;
  bgImageOpacity?: number;
}): PageSection {
  return {
    type: 'cta_1',
    data: {
      theme: 'dark',
      title: opts.title || 'Prendre rendez-vous à Palézieux-Gare',
      description:
        opts.description ||
        "Je vous réponds sous 24 h, en semaine comme le samedi. Écrivez-moi le soin qui vous intéresse et le créneau qui vous arrangerait.",
      cta_text: 'Écrire à Emmanuelle',
      cta_href: RESA_HREF,
      button_style: 'primary',
      // Fond marin par défaut — une écume sur granit qui prolonge l'univers
      // Phytomer utilisé en cabine. La couleur reste posée en dessous, pour
      // que la section garde une identité même si l'image tarde à charger.
      bg_color: opts.bgColor || '#12283A',
      bg_image: opts.bgImage ?? IMG_MARINE_ECUME,
      bg_image_opacity: opts.bgImageOpacity ?? 45,
      bg_image_position: 'center',
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   PAGES — HOME + CATÉGORIES + SOINS + À PROPOS + CONTACT + BON CADEAU
   ────────────────────────────────────────────────────────────────────────*/

const HOME: SeoPageSeed = {
  title: 'Accueil',
  slug: 'home',
  published: true,
  seo: {
    title: 'Institut de beauté à domicile · Palézieux-Gare (Vaud)',
    description:
      "Emmanuelle Esthétique : soins du visage, Head Spa, massages et épilation dans un cocon à domicile à Palézieux-Gare. Prendre rendez-vous en ligne.",
    og_title: 'Emmanuelle Esthétique — Institut à domicile · Palézieux-Gare',
    og_description:
      "Un cocon de douceur à 2 minutes de la gare CFF de Palézieux. Soins Phytomer, Head Spa, épilation au sucre — sur rendez-vous, uniquement pour vous.",
    keywords:
      'institut beauté Palézieux, esthéticienne Palézieux-Gare, soin visage Palézieux, Head Spa Vaud, massage relaxant Broye, épilation au sucre Oron',
  },
  sections: [
    {
      type: 'hero_1',
      data: {
        theme: 'light',
        eyebrow: `Institut de beauté à domicile · ${CITY_TAG}`,
        title: 'Votre parenthèse de douceur',
        title_italic: 'à Palézieux-Gare',
        description:
          "Soins du visage Phytomer, Head Spa, massages relaxants et beauté du regard, dans un cocon à domicile à 2 minutes de la gare CFF de Palézieux, au cœur de la Haute-Broye vaudoise. Sur rendez-vous, uniquement pour les femmes de la région.",
        image_url: IMG_VISAGE,
        image_alt:
          "Soin du visage prodigué à l'institut Emmanuelle Esthétique à Palézieux-Gare",
        image_position: 'right',
        image_width: 'half',
        bg_image_opacity: 19,
        cta_primary_text: 'Prendre rendez-vous',
        cta_primary_href: RESA_HREF,
        cta_secondary_text: 'Voir tous les soins',
        cta_secondary_href: '/soins',
        button_style: 'primary',
      },
    },
    {
      type: 'marquee_1',
      data: {
        items: [
          'Soins du visage Phytomer',
          'Head Spa & massage du cuir chevelu',
          'Massage relaxant aux huiles chaudes',
          'Épilation à la cire au sucre',
          'Beauté du regard',
          'Ateliers Gua Sha & Glowing Face',
        ],
        speed: 'normal',
        italic: true,
        separator: '●',
        bg_color: '#FFFFFF',
        text_color: '#7C8A6E',
      },
    },
    // Réponse GEO factuelle : où, quoi, pour qui, quand — un LLM peut citer
    // ce paragraphe directement dans une AI Overview.
    introGeo({
      eyebrow: 'En résumé',
      quote: 'Un institut à domicile, pensé comme un cocon.',
      text:
        "Emmanuelle Esthétique est un institut de beauté et bien-être <strong>à domicile</strong>, situé <strong>Chemin de la Marouette 19, 1607 Palézieux</strong> (canton de Vaud, Suisse), à <strong>2 minutes à pied de la gare CFF de Palézieux</strong>. L'institut est <strong>réservé aux femmes</strong>, sur rendez-vous, du <strong>lundi au samedi</strong>, de 9 h à 19 h. On y trouve des soins du visage Phytomer, du Head Spa, des massages aux huiles chaudes, de l'épilation à la cire de sucre et des ateliers d'auto-soin.",
      image: IMG_ACCUEIL,
      imagePosition: 'right',
      bgColor: CREME,
    }),
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'Nos univers',
        title: 'Cinq façons de prendre soin de vous à Palézieux-Gare',
        description:
          'Chaque soin est pensé pour votre peau, votre humeur du jour et votre rythme. Cliquez pour découvrir le protocole complet.',
        bg_color: '#FFFFFF',
        cards: [
          {
            icon: '',
            icon_image: IMG_VISAGE,
            title: 'Soins du visage',
            description:
              "Nettoyage, gommage, masque, massage manuel et sérum Phytomer, adaptés à votre type de peau — sensible, mixte, mature ou fatiguée.",
            link_text: 'Découvrir les soins visage',
            link_href: '/soins-visage-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_MASSAGE,
            title: 'Soins du corps',
            description:
              "Massage relaxant aux huiles chaudes et Head Spa (massage du cuir chevelu). Objectif : souffler, relâcher, dormir mieux.",
            link_text: 'Voir les soins corps',
            link_href: '/soins-corps-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_REGARD,
            title: 'Beauté du regard',
            description:
              "Sourcils dessinés, teinture cils & sourcils, rehaussement de cils, cours de maquillage sur-mesure — pour un regard qui change tout.",
            link_text: 'Beauté du regard',
            link_href: '/beaute-du-regard-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_EPILATION,
            title: 'Épilation au sucre',
            description:
              "Cire au sucre, quasi indolore, adaptée aux zones sensibles. Une pâte 100 % naturelle rincée à l'eau — respectueuse des peaux réactives.",
            link_text: 'Épilation au sucre',
            link_href: '/epilation-sucre-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_ATELIER,
            title: 'Ateliers d\'auto-soin',
            description:
              "Gua Sha, Glowing Face, cours de maquillage : apprenez les gestes qui prolongent le soin, en petit comité, dans une ambiance conviviale.",
            link_text: 'Découvrir les ateliers',
            link_href: '/ateliers-bien-etre-palezieux',
          },
          {
            icon: '🎁',
            title: 'Bons cadeaux',
            description:
              "Offrir une bulle de détente : bon cadeau du montant de votre choix ou d'un soin précis, valable 60 mois.",
            link_text: 'Offrir un bon cadeau',
            link_href: '/bon-cadeau',
          },
        ],
      },
    },
    // Réassurance & positionnement
    {
      type: 'intro_1',
      data: {
        theme: 'light',
        eyebrow: 'Le concept',
        quote: 'Bienvenue chez Emmanuelle Esthétique et bien-être',
        text:
          "Je vous accueille dans votre cabine privée, à Palézieux-Gare, à seulement 20 à 30 minutes de <strong>Lausanne</strong>, <strong>Vevey</strong>, <strong>Montreux</strong>, <strong>Bulle</strong> et <strong>Fribourg</strong>. Un espace confidentiel et apaisant, loin de l'agitation des grandes enseignes, pensé pour vous proposer une autre façon de prendre soin de vous : en douceur, en prenant le temps, sans aucun jugement.",
        cta_text: 'Faisons connaissance',
        cta_href: '/a-propos',
        image_url: IMG_COCON,
        image_alt:
          "Emmanuelle, esthéticienne diplômée à Palézieux-Gare depuis plus de 20 ans",
        image_position: 'right',
        button_style: 'primary',
      },
    },
    // Signaux d'autorité E-E-A-T
    {
      type: 'stats_1',
      data: {
        theme: 'light',
        eyebrow: 'La maison',
        title: "Ce qui ne change jamais",
        bg_color: CREME,
        cards: [
          { value: '20+', label: "années de pratique de l'esthétique" },
          { value: 'Phytomer', label: 'cosmétiques marins naturels' },
          { value: '2 min', label: 'à pied de la gare CFF de Palézieux' },
          { value: '100 %', label: 'sur rendez-vous, entre femmes' },
        ],
      },
    },
    // Bon cadeau
    ctaFinal({
      title: 'Offrez une parenthèse de douceur',
      description:
        "Bon cadeau du montant ou du soin de votre choix, à télécharger ou à recevoir par la poste. Valable 60 mois. Une bulle qu'on n'oublie pas.",
      bgColor: SAGE_BG,
    }),
    // Infos pratiques (schema Place / GEO)
    {
      type: 'text_image_1',
      data: {
        theme: 'light',
        eyebrow: 'Infos pratiques · Accès',
        title: 'Venir à l\'institut',
        bg_color: '#FFFFFF',
        ratio: 'third',
        image_position: 'right',
        image_url: IMG_ACCUEIL,
        image_alt: 'Espace de soin lumineux à Palézieux-Gare, canton de Vaud',
        content:
          '<p>L\'institut se trouve <strong>Chemin de la Marouette 19, 1607 Palézieux (Vaud)</strong>, dans le <strong>district de Lavaux-Oron</strong>. Espace privé à domicile — l\'adresse exacte et le plan d\'accès vous sont transmis à la confirmation de votre rendez-vous.</p>' +
          '<h2>En train (CFF)</h2>' +
          '<p><strong>2 minutes à pied</strong> depuis la gare de Palézieux, arrêt IR15 et S4. Lignes directes depuis Lausanne (18 min), Fribourg (25 min), Romont, Vevey (17 min).</p>' +
          '<h2>En voiture</h2>' +
          '<p><strong>Place de parking gratuite</strong> devant l\'institut. Sortie autoroute A12 <em>Châtillens/Oron</em> à 5 minutes, ou A9 <em>Chexbres</em> depuis la Riviera (Vevey, Montreux, Lavaux).</p>' +
          '<h2>Prendre rendez-vous</h2>' +
          '<p>Soins <strong>réservés aux femmes</strong>, <strong>uniquement sur rendez-vous</strong>. Créneaux 10 h ou 14 h, en semaine comme le samedi. Écrivez-moi via le <a href="/contact">formulaire de contact</a> — je vous réponds sous 24 heures.</p>',
      },
    },
    // FAQ locale globale
    faqLocale({
      title: 'Vos questions avant le premier rendez-vous',
      bgColor: CREME,
      cards: [
        {
          question: "Où se trouve exactement l'institut à Palézieux ?",
          answer:
            "L'institut est à domicile, Chemin de la Marouette 19, 1607 Palézieux, à 2 minutes à pied de la gare CFF de Palézieux (canton de Vaud, district de Lavaux-Oron). Une place de parking gratuite est réservée aux clientes. L'adresse complète est confirmée à la prise de rendez-vous.",
        },
        {
          question: "Depuis quelles communes venez-vous habituellement ?",
          answer:
            "Mes clientes viennent principalement de Palézieux-Gare, Palézieux-Village, Oron, Châtel-St-Denis, Chexbres, Puidoux, Rue, Bulle, Vevey, Lavaux et la Broye vaudoise et fribourgeoise. L'accès train + parking rend le trajet simple depuis toute la Suisse romande.",
        },
        {
          question: "Comment prendre rendez-vous ?",
          answer:
            "Par le formulaire de contact du site (réponse sous 24 h) ou par téléphone. Je propose des créneaux 10 h ou 14 h, en semaine comme le samedi. Les soins sont réservés aux femmes.",
        },
        {
          question: "Quels moyens de paiement acceptez-vous ?",
          answer:
            "TWINT, espèces et cartes bancaires en cabine. Une facture nominative conforme au droit suisse vous est remise à chaque visite. Les bons cadeaux Emmanuelle Esthétique sont bien sûr acceptés.",
        },
      ],
    }),
    ctaFinal({
      title: 'Réserver votre parenthèse à Palézieux-Gare',
      description:
        "Dites-moi simplement ce qui vous ferait du bien, je vous oriente vers le soin le plus adapté et je vous propose deux créneaux.",
    }),
  ],
};

const APROPOS: SeoPageSeed = {
  title: 'À propos',
  slug: 'a-propos',
  published: true,
  seo: {
    title: 'Emmanuelle, esthéticienne à Palézieux-Gare (20+ ans)',
    description:
      "Esthéticienne diplômée depuis plus de 20 ans, je vous accueille dans mon institut à domicile à Palézieux-Gare, canton de Vaud. Rencontre.",
    og_title: "Rencontrer Emmanuelle — esthéticienne à Palézieux-Gare",
    og_description:
      "20 ans d'expérience, produits Phytomer, cadre intimiste. Pourquoi j'ai choisi de recevoir mes clientes chez moi, à Palézieux-Gare.",
    keywords:
      'esthéticienne Palézieux, esthéticienne Vaud diplômée, Emmanuelle Le Tousse, institut à domicile Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Qui suis-je',
      title: 'Bienvenue chez Emmanuelle',
      description:
        "Esthéticienne diplômée depuis plus de 20 ans, je vous accueille dans mon institut à domicile à Palézieux-Gare — un cocon pensé pour les femmes de la région qui veulent enfin prendre le temps.",
      cta: 'Prendre rendez-vous',
      // Brume marine posée derrière — respire l'univers Phytomer sans écraser
      // la lecture. Le SAGE_BG reste posé en repli si l'image ne charge pas.
      image: IMG_MARINE_BRUME,
      bgColor: SAGE_BG,
    }),
    {
      type: 'intro_1',
      data: {
        theme: 'surface',
        eyebrow: 'Mon parcours',
        quote: "Prendre soin, c'est d'abord prendre le temps.",
        text:
          "J'ai commencé l'esthétique il y a plus de 20 ans, formée aux techniques manuelles européennes et aux cosmétiques marins Phytomer. Passionnée depuis toujours par les rapports humains, j'aime ce métier parce qu'il me permet de passer mes journées à prendre soin de femmes qui ont envie de prendre soin d'elles — celles qui ont besoin, tout simplement, de faire une pause. Je les aide à lâcher prise par des soins esthétiques doux, pour qu'elles puissent enfin se retrouver et respirer.",
        image_url: 'https://images.pexels.com/photos/6629547/pexels-photo-6629547.jpeg',
        image_alt: 'Emmanuelle Le Tousse, esthéticienne à Palézieux-Gare depuis plus de 20 ans',
        image_position: 'left',
        cta_text: 'Découvrir les soins',
        cta_href: '/soins',
        bg_color: SAGE_BG,
      },
    },
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'Ma façon de travailler',
        title: 'Trois choses qui ne changent jamais',
        bg_color: '#FFFFFF',
        cards: [
          {
            icon: '🌿',
            title: 'Des produits professionnels naturels',
            description:
              "Cosmétiques marins Phytomer, choisis pour leur composition, leur douceur, leurs textures sensorielles. Rien d'invasif, rien de miracle — du soin, vraiment.",
          },
          {
            icon: '⏳',
            title: 'Du temps, vraiment',
            description:
              "Chaque rendez-vous prévoit un moment d'échange avant et après le soin. On regarde ensemble ce dont votre peau a besoin ce jour-là — pas ce que le catalogue impose.",
          },
          {
            icon: '🤍',
            title: 'Aucun jugement',
            description:
              "Peau sensible, exigeante, pas de temps pour vous depuis des mois, premier rendez-vous en institut : rien de tout ça ne se commente. On part d'où vous en êtes, en toute confidentialité.",
          },
        ],
      },
    },
    // E-E-A-T : expérience et localisation renforcées
    {
      type: 'text_image_1',
      data: {
        theme: 'light',
        eyebrow: 'Pourquoi à domicile',
        title: 'Un cocon plutôt qu\'un institut de centre-ville',
        bg_color: CREME,
        ratio: 'third',
        image_position: 'right',
        image_url: IMG_COCON,
        image_alt: 'Cocon de soin lumineux à Palézieux-Gare',
        content:
          '<p>J\'ai choisi de recevoir chez moi, à <strong>Palézieux-Gare</strong>, parce que la beauté et la détente demandent du calme. Vous êtes seule dans la cabine, on ne vous presse pas, on ne vous vend rien à la sortie.</p>' +
          '<p>C\'est aussi une réponse concrète aux femmes de la région (<strong>Palézieux, Oron, Châtel-St-Denis, la Broye, Lavaux</strong>) qui ne veulent pas perdre leur pause détente dans les bouchons de Lausanne ou Vevey. Ici, on est à 2 minutes de la gare, et il y a une place de parking gratuite.</p>',
      },
    },
    ctaFinal({
      title: 'Envie de faire connaissance ?',
      description:
        "Le plus simple reste de venir. Écrivez-moi le soin qui vous intéresse et nous trouvons un créneau ensemble.",
    }),
  ],
};

const CONTACT: SeoPageSeed = {
  title: 'Contact, accès & horaires',
  slug: 'contact',
  published: true,
  seo: {
    title: 'Contact & accès · Institut Palézieux-Gare (Vaud)',
    description:
      "Adresse, gare CFF, parking, horaires et formulaire de contact d'Emmanuelle Esthétique à Palézieux-Gare. Réponse sous 24 h.",
    og_title: 'Contact — Institut Emmanuelle Esthétique · Palézieux-Gare',
    og_description:
      "Chemin de la Marouette 19, 1607 Palézieux · 2 min à pied de la gare · parking gratuit · sur rendez-vous du lundi au samedi.",
    keywords:
      'contact esthéticienne Palézieux, adresse institut Palézieux-Gare, horaires Emmanuelle Esthétique, prendre rendez-vous soin visage Vaud',
  },
  sections: [
    hero({
      eyebrow: 'Contact & accès',
      title: 'Écrire à Emmanuelle',
      description:
        "Institut de beauté à domicile à Palézieux-Gare · Réponse sous 24 h, du lundi au samedi.",
      cta: 'Formulaire ci-dessous',
      ctaHref: '#formulaire',
      // Horizon marin — cohérent avec l'univers spa, apaise avant le
      // formulaire de contact plutôt qu'un aplat crème sans matière.
      image: IMG_MARINE_HORIZON,
      bgColor: CREME,
    }),
    introGeo({
      eyebrow: 'En bref',
      quote: 'Un institut à domicile, à 2 minutes de la gare de Palézieux.',
      text:
        "L'institut Emmanuelle Esthétique se trouve <strong>Chemin de la Marouette 19, 1607 Palézieux, canton de Vaud, Suisse</strong>. À <strong>2 minutes à pied</strong> de la gare CFF de Palézieux (IR15, S4). <strong>Place de parking gratuite</strong> devant l'institut. Ouvert <strong>du lundi au samedi, 9 h – 19 h, sur rendez-vous</strong>. Téléphone : <a href=\"tel:+41788236612\">+41 78 823 66 12</a>. E-mail : <a href=\"mailto:e.letousse@gmail.com\">e.letousse@gmail.com</a>.",
      image: IMG_ACCUEIL,
      imagePosition: 'right',
      bgColor: '#FFFFFF',
    }),
    {
      type: 'contact_1',
      data: {
        theme: 'light',
        title: 'Coordonnées',
        description:
          "Le formulaire ci-dessous est le moyen le plus simple. Je vous réponds sous 24 h avec deux propositions de créneaux.",
        address: 'Chemin de la Marouette 19 · 1607 Palézieux (Vaud, Suisse)',
        phone: '+41 78 823 66 12',
        email: 'e.letousse@gmail.com',
        hours: 'Lundi – samedi : 9 h – 19 h · Sur rendez-vous',
      },
    },
    {
      type: 'text_image_1',
      data: {
        theme: 'light',
        eyebrow: 'Accès détaillé',
        title: 'Comment venir à l\'institut',
        bg_color: CREME,
        ratio: 'third',
        image_position: 'left',
        image_url: IMG_COCON,
        image_alt: 'Accès à l\'institut Emmanuelle Esthétique à Palézieux-Gare',
        content:
          '<h2>En train (CFF)</h2>' +
          '<p>La gare CFF de Palézieux est à <strong>2 minutes à pied</strong>. Lignes directes :</p>' +
          '<ul>' +
          '<li><strong>Depuis Lausanne</strong> : IR15, 18 min de trajet.</li>' +
          '<li><strong>Depuis Vevey / Riviera</strong> : S4, 17 min.</li>' +
          '<li><strong>Depuis Fribourg / Bulle</strong> : IR15, 25 min.</li>' +
          '<li><strong>Depuis Romont, Oron, Puidoux</strong> : S4 directe.</li>' +
          '</ul>' +
          '<h2>En voiture</h2>' +
          '<p><strong>Place de parking gratuite</strong> réservée aux clientes, devant l\'institut. Accès autoroute :</p>' +
          '<ul>' +
          '<li>A12 sortie <em>Châtillens / Oron</em> — 5 min.</li>' +
          '<li>A9 sortie <em>Chexbres</em> depuis la Riviera — 15 min.</li>' +
          '</ul>' +
          '<h2>Horaires</h2>' +
          '<p>Lundi au samedi, 9 h à 19 h, <strong>uniquement sur rendez-vous</strong>. Les créneaux 10 h et 14 h sont les plus demandés — pensez à réserver 1 à 2 semaines à l\'avance pour les samedis.</p>' +
          '<h2>Bon à savoir</h2>' +
          '<p>Les soins sont réservés aux femmes. Prévoyez 30 minutes de plus que la durée annoncée du soin, pour l\'accueil et le temps d\'échange.</p>',
      },
    },
    faqLocale({
      title: 'Questions fréquentes sur l\'accès',
      cards: [
        {
          question: "Combien de temps de trajet depuis Lausanne, Vevey ou Fribourg ?",
          answer:
            "Palézieux-Gare est à 18 minutes en train direct de Lausanne, 17 minutes de Vevey, 25 minutes de Fribourg et 12 minutes de Bulle. En voiture, comptez 25-30 minutes depuis Lausanne ou la Riviera vaudoise par l'A12 ou l'A9.",
        },
        {
          question: "Y a-t-il un parking près de l'institut ?",
          answer:
            "Oui, une place de parking gratuite est réservée devant l'institut, à Palézieux-Gare. Aucun stationnement payant en zone bleue à gérer.",
        },
        {
          question: "L'institut est-il accessible aux personnes à mobilité réduite ?",
          answer:
            "L'accès se fait par une entrée privée à domicile ; merci de m'écrire avant votre venue si vous avez un besoin d'accessibilité particulier, je vous confirme les conditions d'accueil.",
        },
      ],
    }),
    // Formulaire de contact rendu par la route hard-codée sur /contact (voir contact/page.tsx)
    // — quand la page dynamique existe, elle passe devant, donc j'ajoute un CTA vers un module de résa externe si présent.
    ctaFinal({
      title: 'Prendre rendez-vous',
      description:
        "Le plus simple : le formulaire ci-dessous. Ou par téléphone au +41 78 823 66 12 (réponse sous 24 h).",
    }),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   PAGE CATÉGORIE — SOINS DU VISAGE
   ────────────────────────────────────────────────────────────────────────*/

const SOINS_VISAGE: SeoPageSeed = {
  title: 'Soins du visage à Palézieux',
  slug: 'soins-visage-palezieux',
  published: true,
  seo: {
    title: 'Soins du visage Phytomer · Palézieux-Gare (Vaud)',
    description:
      "Soin signature, anti-âge, peau sensible, éclat : les soins visage sur-mesure d'Emmanuelle Esthétique à Palézieux-Gare. Sur rendez-vous.",
    og_title: 'Soins du visage à Palézieux-Gare — Phytomer sur-mesure',
    og_description:
      "Nettoyage, gommage, masque, massage manuel Phytomer. Chaque protocole est adapté à votre peau à Palézieux-Gare.",
    keywords:
      'soin visage Palézieux, soin visage Vaud, soin Phytomer Palézieux, esthéticienne visage Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Silo — soins du visage',
      title: 'Soins du visage à Palézieux-Gare',
      description:
        "Trois protocoles Phytomer, ajustés à votre peau : signature, anti-âge, peau sensible. Le rituel est le même — l'écoute, la douceur, un vrai temps pour vous.",
      cta: 'Réserver un soin visage',
      image: IMG_VISAGE,
    }),
    introGeo({
      eyebrow: 'En bref',
      quote: 'Un soin qui écoute votre peau, pas un catalogue.',
      text:
        "À l'institut Emmanuelle Esthétique de <strong>Palézieux-Gare (Vaud)</strong>, chaque soin du visage suit un rituel en 5 temps : accueil et diagnostic de peau, démaquillage double, gommage doux, masque et sérum <strong>Phytomer</strong>, massage manuel du visage. Le protocole est adapté à votre type de peau — <strong>sensible, mixte, mature ou déshydratée</strong> — et à la saison. Comptez <strong>60 à 90 minutes</strong>, à partir de <strong>CHF 130</strong>.",
      image: IMG_VISAGE,
    }),
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'Nos soins visage',
        title: 'Trois protocoles, sur-mesure',
        bg_color: CREME,
        cards: [
          {
            icon: '',
            icon_image: IMG_VISAGE,
            title: 'Soin signature',
            description:
              "Le rituel complet Phytomer, adapté à votre peau du jour. Idéal pour un premier soin ou une remise à niveau.",
            link_text: 'Voir le protocole',
            link_href: '/soin-visage-signature-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_ANTIAGE,
            title: 'Soin anti-âge',
            description:
              "Manœuvres liftantes manuelles inspirées du massage kobido, actifs Phytomer ciblés. Repulpe, redessine, illumine.",
            link_text: 'Voir le protocole',
            link_href: '/soin-anti-age-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_COCON,
            title: 'Soin peau sensible',
            description:
              "Textures ultra-douces, gestes lents, actifs apaisants. Pensé pour les peaux réactives, rosacées, sujettes aux rougeurs.",
            link_text: 'Voir le protocole',
            link_href: '/soin-visage-peau-sensible-palezieux',
          },
        ],
      },
    },
    faqLocale({
      title: 'Vos questions sur les soins du visage',
      cards: [
        {
          question: "Combien coûte un soin du visage à Palézieux ?",
          answer:
            "Les tarifs indicatifs à l'institut Emmanuelle Esthétique de Palézieux-Gare sont de CHF 130 pour un soin signature 60 min, CHF 170 pour un soin anti-âge 90 min et CHF 150 pour un soin peau sensible 75 min. Le tarif exact est confirmé à la prise de rendez-vous.",
        },
        {
          question: "Quel soin visage choisir pour ma peau ?",
          answer:
            "On en parle ensemble à la prise de rendez-vous. Peau sensible ou réactive : soin peau sensible. Signes de l'âge, perte de fermeté : soin anti-âge. Premier soin ou entretien général : soin signature. Vous ne choisissez pas seule — c'est le rôle du diagnostic de peau en début de séance.",
        },
        {
          question: "Utilisez-vous des appareils ou uniquement du manuel ?",
          answer:
            "Uniquement des techniques manuelles à Palézieux-Gare : massage, drainage, manœuvres liftantes. Pas d'appareil radiofréquence, pas de LED. Le résultat vient du geste et des actifs Phytomer, pas de la machine.",
        },
      ],
    }),
    ctaFinal({
      title: 'Réserver un soin visage à Palézieux-Gare',
    }),
  ],
};

/* Pages de soins individuelles — Visage */

const SOIN_SIGNATURE: SeoPageSeed = {
  title: 'Soin visage signature',
  slug: 'soin-visage-signature-palezieux',
  published: true,
  seo: {
    title: 'Soin visage signature Phytomer · Palézieux-Gare',
    description:
      "60 min de rituel Phytomer sur-mesure à l'institut Emmanuelle Esthétique de Palézieux-Gare. Dès CHF 130. Sur rendez-vous.",
    og_title: 'Soin visage signature à Palézieux-Gare',
    og_description:
      "Nettoyage, gommage, masque, massage manuel Phytomer. Le rituel qui redonne de l'éclat.",
    keywords:
      'soin visage Palézieux, soin visage signature Vaud, soin Phytomer Palézieux, esthéticienne soin visage',
  },
  sections: [
    hero({
      eyebrow: 'Soin du visage · Palézieux-Gare',
      title: 'Soin visage signature Phytomer',
      description:
        "Le rituel complet en 5 temps, adapté à votre peau du jour. 60 minutes de vraie détente, à l'institut de Palézieux-Gare.",
      cta: 'Réserver ce soin',
      image: IMG_VISAGE,
    }),
    introGeo({
      eyebrow: 'En bref',
      quote: 'Un vrai soin, pour toutes les peaux.',
      text:
        "Le soin visage signature est le protocole d'entrée d'Emmanuelle Esthétique à <strong>Palézieux-Gare</strong>. Il combine <strong>diagnostic de peau, double démaquillage, gommage enzymatique doux, masque Phytomer, sérum ciblé et massage manuel</strong>. Adapté à toutes les peaux (jeune, mixte, sèche, mature). Durée : <strong>60 minutes</strong>. Tarif indicatif : <strong>CHF 130</strong>.",
      image: IMG_VISAGE,
    }),
    protocole({
      title: 'Le déroulement du soin — 60 minutes',
      cards: [
        {
          title: '1. Accueil & diagnostic',
          description:
            "10 min. On parle peau, saison, habitudes. Je regarde votre grain de peau à la loupe et je choisis les textures adaptées.",
        },
        {
          title: '2. Nettoyage & gommage',
          description:
            "15 min. Double démaquillage à l'huile puis à l'émulsion Phytomer, gommage enzymatique doux — pas d'abrasion.",
        },
        {
          title: '3. Massage manuel',
          description:
            "15 min. Manœuvres de drainage lymphatique et de détente musculaire. C'est le moment où on lâche prise.",
        },
        {
          title: '4. Masque & sérum',
          description:
            "15 min. Masque Phytomer ciblé (hydratation, éclat, apaisant). Sérum et crème de protection appliqués en fin de séance.",
        },
      ],
    }),
    tarifBloc({
      title: 'Soin visage signature — CHF 130',
      price: 'CHF 130',
      priceNote: '· 60 minutes',
      items: [
        'Diagnostic de peau personnalisé',
        'Double démaquillage & gommage doux',
        'Masque Phytomer adapté à votre peau',
        'Massage manuel visage (15 min)',
        'Sérum + crème de finition',
        'Conseils routine à la maison',
      ],
      cta: 'Réserver ce soin',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "À quelle fréquence faire un soin visage à Palézieux ?",
          answer:
            "Un soin toutes les 4 à 6 semaines correspond à un cycle de renouvellement cutané. Beaucoup de mes clientes de Palézieux, Oron ou Châtel-St-Denis viennent tous les mois pour entretenir, et 2 fois par an pour un soin plus profond (anti-âge ou éclat).",
        },
        {
          question: "Puis-je maquiller après le soin ?",
          answer:
            "Idéalement non pendant les 3 à 4 heures qui suivent : la peau vient d'être nourrie et respire mieux sans maquillage. Prévoyez le soin en fin de journée ou avant un moment tranquille.",
        },
        {
          question: "Le soin convient-il à une peau à tendance acnéique ?",
          answer:
            "Oui, en ajustant les textures (sans huiles comédogènes) et en évitant les manœuvres appuyées. Signalez-le à la prise de rendez-vous, je prévois les produits en conséquence.",
        },
      ],
    }),
    ctaFinal({
      title: 'Réserver votre soin signature à Palézieux-Gare',
    }),
  ],
};

const SOIN_ANTIAGE: SeoPageSeed = {
  title: 'Soin visage anti-âge',
  slug: 'soin-anti-age-palezieux',
  published: true,
  seo: {
    title: 'Soin anti-âge visage · Palézieux-Gare (Vaud)',
    description:
      "Manœuvres liftantes manuelles et actifs Phytomer ciblés. 90 min. Institut à domicile à Palézieux-Gare. Dès CHF 170.",
    og_title: 'Soin anti-âge à Palézieux-Gare — Emmanuelle Esthétique',
    og_description:
      "Soin visage anti-âge par massage manuel liftant. Repulpe, redessine, illumine. Sans machine, sans injection.",
    keywords:
      'soin anti-âge Palézieux, soin liftant Vaud, kobido Palézieux, soin fermeté visage, anti-rides Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Soin du visage · Palézieux-Gare',
      title: 'Soin visage anti-âge & manœuvres liftantes',
      description:
        "90 minutes de massage manuel inspiré des techniques japonaises et occidentales, avec les actifs ciblés Phytomer. Un vrai lifting sans machine ni piqûre.",
      cta: 'Réserver ce soin',
      image: IMG_ANTIAGE,
    }),
    introGeo({
      eyebrow: 'En bref',
      quote: "L'âge, sans avoir l'air d'y toucher.",
      text:
        "Le soin visage anti-âge d'Emmanuelle Esthétique à <strong>Palézieux-Gare</strong> combine des <strong>manœuvres manuelles liftantes</strong> (inspirées du massage kobido japonais et des techniques européennes de sculpting) avec les <strong>sérums et masques anti-âge Phytomer</strong>. Objectif : redonner de la fermeté, redessiner l'ovale, drainer et illuminer. Zéro machine, zéro produit injecté. Durée : <strong>90 minutes</strong>. Tarif indicatif : <strong>CHF 170</strong>.",
      image: IMG_ANTIAGE,
    }),
    protocole({
      title: 'Le protocole en 5 temps — 90 minutes',
      cards: [
        {
          title: '1. Bilan & double démaquillage',
          description:
            "15 min. Diagnostic ciblé : perte de fermeté, ridules, éclat, teint. Choix des textures Phytomer anti-âge.",
        },
        {
          title: '2. Peeling doux & vapeur',
          description:
            "15 min. Peeling enzymatique pour préparer la peau, brume tiède pour dilater les pores et faciliter la pénétration.",
        },
        {
          title: '3. Manœuvres liftantes',
          description:
            "30 min. Le cœur du soin : massage en profondeur inspiré du kobido, drainage lymphatique, sculpting de l'ovale et du contour des yeux.",
        },
        {
          title: '4. Masque anti-âge & sérum',
          description:
            "20 min. Masque tissu ou crème Phytomer, temps de pose long avec massage crânien. Sérum et crème de jour anti-âge.",
        },
      ],
    }),
    tarifBloc({
      title: 'Soin visage anti-âge — CHF 170',
      price: 'CHF 170',
      priceNote: '· 90 minutes',
      items: [
        'Diagnostic anti-âge personnalisé',
        'Double démaquillage + peeling doux',
        '30 min de manœuvres liftantes manuelles',
        'Masque Phytomer anti-âge',
        'Sérum + crème anti-âge de finition',
        "Cure de 3 soins : -10 % (CHF 459)",
      ],
      cta: 'Réserver ce soin',
    }),
    faqLocale({
      title: 'Questions fréquentes sur le soin anti-âge',
      cards: [
        {
          question: "À partir de quel âge un soin anti-âge est-il utile ?",
          answer:
            "Il n'y a pas d'âge fixe. En prévention (fermeté, éclat), à partir de 30-35 ans, 2 à 3 fois par an. En correction (perte d'ovale, ridules marquées), à partir de 45 ans, une cure de 3 à 6 soins espacés de 3 semaines donne les résultats les plus visibles. Vous verrez la différence dès la première séance.",
        },
        {
          question: "Ce soin remplace-t-il des injections ou un lifting médical ?",
          answer:
            "Non. C'est un soin esthétique manuel : il agit sur la tonicité musculaire, la circulation, la qualité de la peau et l'éclat. Il ne prétend pas remplacer un acte médical, mais il en repousse souvent l'envie ou en prolonge les effets.",
        },
        {
          question: "Combien de temps durent les effets ?",
          answer:
            "L'effet immédiat (éclat, ovale redessiné) est visible en sortant du soin et dure 2 à 3 semaines. Pour un effet durable, il faut un espacement rapproché (3 semaines) sur 3 à 6 séances, puis un entretien mensuel.",
        },
      ],
    }),
    ctaFinal({
      title: 'Réserver votre soin anti-âge à Palézieux-Gare',
    }),
  ],
};

const SOIN_PEAU_SENSIBLE: SeoPageSeed = {
  title: 'Soin visage peau sensible',
  slug: 'soin-visage-peau-sensible-palezieux',
  published: true,
  seo: {
    title: 'Soin visage peau sensible · Palézieux-Gare (Vaud)',
    description:
      "Pensé pour les peaux réactives, rosacées ou sujettes aux rougeurs. Textures douces Phytomer, gestes lents. Dès CHF 150.",
    og_title: 'Soin visage peau sensible à Palézieux-Gare',
    og_description:
      "Un rituel apaisant pour peaux réactives. Sans parfum, sans huiles essentielles agressives. À Palézieux-Gare.",
    keywords:
      'soin peau sensible Palézieux, soin peau réactive Vaud, soin apaisant rosacée, soin peau rouge Palézieux',
  },
  sections: [
    hero({
      eyebrow: 'Soin du visage · Palézieux-Gare',
      title: 'Soin visage peau sensible',
      description:
        "Textures douces, gestes lents, actifs apaisants. 75 minutes conçues pour les peaux réactives, rosacées et sujettes aux rougeurs.",
      cta: 'Réserver ce soin',
      image: IMG_COCON,
    }),
    introGeo({
      eyebrow: 'En bref',
      quote: 'Le vrai luxe, pour une peau réactive : la douceur.',
      text:
        "Le soin visage peau sensible d'Emmanuelle Esthétique à <strong>Palézieux-Gare</strong> est un rituel <strong>apaisant, sans parfum agressif ni huiles essentielles chaudes</strong>. Il combine un <strong>nettoyage à l'émulsion micellaire</strong>, un <strong>masque calmant Phytomer</strong> (aux algues brunes ou à l'eau florale), et un <strong>massage manuel très lent</strong>. Pensé pour les peaux <strong>réactives, sujettes aux rougeurs ou à la couperose</strong>. Durée : <strong>75 minutes</strong>. Tarif : <strong>CHF 150</strong>.",
      image: IMG_COCON,
    }),
    protocole({
      title: 'Le protocole douceur — 75 minutes',
      cards: [
        {
          title: '1. Écoute & diagnostic',
          description:
            "10 min. On identifie les déclencheurs (chaud/froid, produits, stress) et les zones réactives. Rien ne se fait sans votre accord.",
        },
        {
          title: '2. Nettoyage doux',
          description:
            "15 min. Émulsion micellaire à l'eau tiède, sans frottement. Pas de peeling, pas de gommage abrasif.",
        },
        {
          title: '3. Massage lent apaisant',
          description:
            "20 min. Manœuvres très lentes de drainage, pression douce sur les points de tension. Effet anti-rougeurs.",
        },
        {
          title: '4. Masque calmant Phytomer',
          description:
            "20 min. Masque tissu à l'algue brune ou à l'eau florale, temps de pose long. Sérum apaisant + crème de finition.",
        },
      ],
    }),
    tarifBloc({
      title: 'Soin peau sensible — CHF 150',
      price: 'CHF 150',
      priceNote: '· 75 minutes',
      items: [
        'Diagnostic peaux réactives',
        'Nettoyage sans frottement',
        'Massage manuel très lent (20 min)',
        'Masque calmant Phytomer',
        'Sérum apaisant + crème anti-rougeurs',
        'Conseils routine peau sensible',
      ],
      cta: 'Réserver ce soin',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "Ce soin convient-il en cas de rosacée ou couperose ?",
          answer:
            "Oui, c'est même sa vocation. Les gestes évitent les frottements et la chaleur, les produits ne contiennent pas d'huiles essentielles chauffantes. Signalez le diagnostic à la prise de rendez-vous.",
        },
        {
          question: "Puis-je faire ce soin si j'ai eu une réaction ailleurs ?",
          answer:
            "Oui. On commence toujours par un test de tolérance sur une petite zone. Si votre peau réagit à un produit ou une manœuvre, on ajuste immédiatement.",
        },
        {
          question: "Combien de séances pour voir un vrai apaisement ?",
          answer:
            "Beaucoup ressentent la différence dès la première séance. Pour un effet durable sur les rougeurs, comptez 3 à 4 séances espacées de 3 à 4 semaines, puis un entretien saisonnier.",
        },
      ],
    }),
    ctaFinal({
      title: 'Réserver un soin peau sensible à Palézieux-Gare',
    }),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   PAGE CATÉGORIE — SOINS DU CORPS
   ────────────────────────────────────────────────────────────────────────*/

const SOINS_CORPS: SeoPageSeed = {
  title: 'Soins du corps à Palézieux',
  slug: 'soins-corps-palezieux',
  published: true,
  seo: {
    title: 'Massages & Head Spa · Palézieux-Gare (Vaud)',
    description:
      "Massage relaxant aux huiles chaudes et Head Spa (massage du cuir chevelu) à Palézieux-Gare. Souffler, dormir mieux, respirer.",
    og_title: 'Soins du corps à Palézieux-Gare — massages et Head Spa',
    og_description:
      "Un massage n'est pas un travail en profondeur : c'est un moment pour souffler. À Palézieux-Gare, canton de Vaud.",
    keywords:
      'massage relaxant Palézieux, Head Spa Vaud, massage cuir chevelu Palézieux, massage huiles chaudes Broye',
  },
  sections: [
    hero({
      eyebrow: 'Silo — soins du corps',
      title: 'Massages & Head Spa à Palézieux-Gare',
      description:
        "Deux protocoles pour souffler : le massage relaxant aux huiles chaudes et le Head Spa (massage du cuir chevelu). Uniquement pour se détendre — pas de travail en profondeur.",
      cta: 'Réserver un massage',
      image: IMG_MASSAGE,
    }),
    introGeo({
      quote: 'Souffler, respirer, dormir mieux.',
      text:
        "Les soins du corps à l'institut Emmanuelle Esthétique de <strong>Palézieux-Gare</strong> sont pensés comme un <strong>vrai temps de détente</strong> — pas comme un massage sportif ou thérapeutique. Deux protocoles : <strong>massage relaxant aux huiles chaudes</strong> (60 ou 90 min) et <strong>Head Spa</strong>, le massage du cuir chevelu qui détend l'esprit autant qu'il fait du bien aux cheveux.",
      image: IMG_MASSAGE,
    }),
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'Deux façons de souffler',
        title: 'Choisissez votre protocole',
        bg_color: CREME,
        cards: [
          {
            icon: '',
            icon_image: IMG_MASSAGE,
            title: 'Massage relaxant aux huiles chaudes',
            description:
              "60 ou 90 min. Huiles végétales tièdes, gestes enveloppants, pression douce. Objectif : lâcher prise complet.",
            link_text: 'Voir le protocole',
            link_href: '/massage-relaxant-huiles-chaudes-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_MASSAGE_TETE,
            title: 'Head Spa · Massage du cuir chevelu',
            description:
              "30 ou 45 min. Un massage crânien lent, avec sérum végétal, qui détend les épaules et calme le mental.",
            link_text: 'Voir le protocole',
            link_href: '/head-spa-palezieux',
          },
        ],
      },
    },
    faqLocale({
      title: 'Vos questions sur les massages',
      cards: [
        {
          question: "Vos massages sont-ils thérapeutiques ?",
          answer:
            "Non. Les massages Emmanuelle Esthétique à Palézieux-Gare sont des massages esthétiques et de bien-être : ils apaisent, drainent doucement, détendent. Pour un travail thérapeutique sur des tensions musculaires profondes, orientez-vous vers un massothérapeute agréé ASCA.",
        },
        {
          question: "Peut-on combiner Head Spa et massage du visage ?",
          answer:
            "Oui, c'est même une des demandes les plus fréquentes. Un Head Spa 30 min ajouté à un soin visage crée un rituel complet de 90 à 120 min, avec un tarif combiné avantageux (à confirmer à la prise de rendez-vous).",
        },
      ],
    }),
    ctaFinal({
      title: 'Réserver un massage à Palézieux-Gare',
    }),
  ],
};

const MASSAGE_RELAXANT: SeoPageSeed = {
  title: 'Massage relaxant aux huiles chaudes',
  slug: 'massage-relaxant-huiles-chaudes-palezieux',
  published: true,
  seo: {
    title: 'Massage relaxant huiles chaudes · Palézieux-Gare',
    description:
      "Massage relaxant du corps aux huiles chaudes à Palézieux-Gare. 60 ou 90 min. Pensé pour souffler, pas pour travailler en profondeur.",
    og_title: 'Massage relaxant aux huiles chaudes à Palézieux-Gare',
    og_description:
      "Un temps pour vous, à 2 min de la gare de Palézieux. Huiles tièdes, gestes enveloppants, silence.",
    keywords:
      'massage relaxant Palézieux, massage huiles chaudes Vaud, massage bien-être Palézieux-Gare, massage détente Broye',
  },
  sections: [
    hero({
      eyebrow: 'Soin du corps · Palézieux-Gare',
      title: 'Massage relaxant aux huiles chaudes',
      description:
        "Un vrai massage détente, aux huiles végétales tièdes, dans un cocon à 2 minutes de la gare de Palézieux. 60 ou 90 minutes.",
      cta: 'Réserver ce massage',
      image: IMG_MASSAGE,
    }),
    introGeo({
      quote: 'Le massage qui apprend à souffler.',
      text:
        "Le massage relaxant d'Emmanuelle Esthétique à <strong>Palézieux-Gare</strong> se fait avec des <strong>huiles végétales tièdes</strong> (macadamia, amande douce, argan) et des <strong>manœuvres enveloppantes lentes</strong>. Il vise la détente, pas le décrassage musculaire. Idéal si vous êtes fatiguée, sur-sollicitée, ou si vous avez du mal à dormir. Durée : <strong>60 min (CHF 120)</strong> ou <strong>90 min (CHF 165)</strong>.",
      image: IMG_MASSAGE,
    }),
    protocole({
      title: 'Le déroulement — 60 ou 90 minutes',
      cards: [
        {
          title: '1. Accueil & choix des huiles',
          description:
            "5 min. On choisit ensemble l'huile et les zones prioritaires (dos, jambes, nuque). Vous vous installez sur la table chauffée.",
        },
        {
          title: '2. Dos & épaules',
          description:
            "20 à 30 min. Longs effleurages, drainage doux, pressions lentes. La partie où les femmes de la Broye et de Lavaux relâchent enfin.",
        },
        {
          title: '3. Jambes & bras',
          description:
            "15 à 25 min. Manœuvres de circulation, du pied vers la hanche. Effet drainant et anti-jambes lourdes.",
        },
        {
          title: '4. Visage & cuir chevelu',
          description:
            "10 à 20 min. Massage du visage et du cuir chevelu pour finir en douceur. C'est souvent là qu'on s'endort.",
        },
      ],
    }),
    tarifBloc({
      title: 'Massage relaxant — 60 ou 90 minutes',
      price: 'CHF 120',
      priceNote: '· 60 min (90 min : CHF 165)',
      items: [
        'Huile végétale tiède choisie avec vous',
        'Massage lent enveloppant',
        'Table chauffante confortable',
        'Silence ou musique douce, à votre goût',
        'Verre de thé à la fin, dans le cocon',
        "Cure de 3 : -10 % (CHF 324 les trois de 60 min)",
      ],
      cta: 'Réserver ce massage',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "Faut-il enlever tous ses vêtements ?",
          answer:
            "Non. Vous gardez vos sous-vêtements bas. Vous êtes couverte d'un drap tiède en permanence et je ne découvre que la zone en cours de massage. La pudeur est respectée à chaque instant.",
        },
        {
          question: "Puis-je venir enceinte ?",
          answer:
            "À partir du 4e mois de grossesse et sans contre-indication médicale, oui. Le massage se fait sur le côté, avec des coussins, et sans pression sur l'abdomen. Signalez-le à la prise de rendez-vous.",
        },
        {
          question: "À quelle fréquence venir ?",
          answer:
            "Ponctuellement (avant un événement, après une période intense) ou en cure (une fois par mois) selon vos besoins. Beaucoup de mes clientes d'Oron, Châtel-St-Denis et Vevey viennent tous les 4 à 6 semaines.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver votre massage à Palézieux-Gare' }),
  ],
};

const HEAD_SPA: SeoPageSeed = {
  title: 'Head Spa — massage du cuir chevelu',
  slug: 'head-spa-palezieux',
  published: true,
  seo: {
    title: 'Head Spa · Massage du cuir chevelu · Palézieux-Gare',
    description:
      "Massage crânien japonais Head Spa à Palézieux-Gare. Détend les épaules, calme le mental, nourrit les cheveux. 30 ou 45 min.",
    og_title: 'Head Spa à Palézieux-Gare — massage du cuir chevelu',
    og_description:
      "Le rituel bien-être qui commence en haut : cuir chevelu, nuque et épaules détendus en 30 minutes.",
    keywords:
      'Head Spa Palézieux, massage cuir chevelu Vaud, massage crânien Palézieux-Gare, spa japonais Suisse romande',
  },
  sections: [
    hero({
      eyebrow: 'Soin du corps · Palézieux-Gare',
      title: 'Head Spa — massage du cuir chevelu',
      description:
        "Un massage crânien lent, avec sérum végétal, qui détend les épaules et calme le mental. Inspiré du rituel Head Spa japonais.",
      cta: 'Réserver un Head Spa',
      image: IMG_MASSAGE_TETE,
    }),
    introGeo({
      quote: 'Détendre le crâne, c\'est détendre le reste.',
      text:
        "Le Head Spa d'Emmanuelle Esthétique à <strong>Palézieux-Gare</strong> est un rituel du <strong>cuir chevelu, de la nuque et des épaules</strong>, inspiré du <strong>Head Spa japonais</strong>. Il combine <strong>pressions lentes, effleurages et sérum végétal nourrissant</strong>. Effet immédiat : détente mentale, cheveux vitalisés, sommeil facilité. Durée : <strong>30 min (CHF 70)</strong> ou <strong>45 min (CHF 95)</strong>. Souvent ajouté à un soin visage.",
      image: IMG_MASSAGE_TETE,
    }),
    protocole({
      title: 'Le déroulement — 30 minutes',
      cards: [
        {
          title: '1. Nuque & trapèzes',
          description:
            "10 min. Pressions lentes sur les points de tension. Beaucoup découvrent là à quel point elles serraient les épaules.",
        },
        {
          title: '2. Cuir chevelu',
          description:
            "10 min. Massage complet du crâne avec un sérum végétal. Manœuvres circulaires qui stimulent la microcirculation.",
        },
        {
          title: '3. Tempes & front',
          description:
            "5 min. Pressions douces qui calment le mental. C'est souvent là qu'on lâche complètement.",
        },
        {
          title: '4. Repos',
          description:
            "5 min. Vous restez allongée, dans le silence, le temps que le sérum agisse. Un thé vous attend en sortant.",
        },
      ],
    }),
    tarifBloc({
      title: 'Head Spa — 30 minutes',
      price: 'CHF 70',
      priceNote: '· 30 min (45 min : CHF 95)',
      items: [
        'Massage nuque et trapèzes',
        'Sérum végétal nourrissant',
        'Massage cuir chevelu complet',
        'Détente des tempes',
        "Peut s'ajouter à un soin visage",
        'Effet immédiat sur le sommeil',
      ],
      cta: 'Réserver un Head Spa',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "Le Head Spa laisse-t-il les cheveux gras ?",
          answer:
            "Non. Le sérum végétal est en petite quantité, pénètre dans le cuir chevelu et se rince facilement au shampoing suivant. Beaucoup de clientes viennent en fin de journée, se lavent les cheveux le soir ou le lendemain matin.",
        },
        {
          question: "Puis-je combiner Head Spa et soin visage ?",
          answer:
            "Oui, c'est même la combinaison la plus demandée. Head Spa 30 min + soin visage 60 min = 90 min de rituel complet, avec un tarif combiné avantageux (précisé à la prise de rendez-vous).",
        },
        {
          question: "Ça convient si j'ai des extensions ou une coloration récente ?",
          answer:
            "Oui, le sérum est doux et n'agresse pas les colorations. Pour les extensions, précisez le type à la prise de rendez-vous — j'adapte la pression sur les zones d'attache.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver un Head Spa à Palézieux-Gare' }),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   CATÉGORIE — BEAUTÉ DU REGARD
   ────────────────────────────────────────────────────────────────────────*/

const BEAUTE_REGARD: SeoPageSeed = {
  title: 'Beauté du regard',
  slug: 'beaute-du-regard-palezieux',
  published: true,
  seo: {
    title: 'Beauté du regard · Palézieux-Gare (Vaud)',
    description:
      "Sourcils dessinés, teinture cils & sourcils, rehaussement de cils, cours de maquillage : la beauté du regard à Palézieux-Gare.",
    og_title: 'Beauté du regard à Palézieux-Gare',
    og_description:
      "Un regard qui change tout, sans en faire trop. À Palézieux-Gare, canton de Vaud.",
    keywords:
      'sourcils Palézieux, teinture cils sourcils Vaud, rehaussement cils Palézieux-Gare, cours maquillage Broye',
  },
  sections: [
    hero({
      eyebrow: 'Silo — beauté du regard',
      title: 'Beauté du regard à Palézieux-Gare',
      description:
        "Quatre prestations pour illuminer le regard sans caricature : sourcils dessinés, teinture cils & sourcils, rehaussement de cils, cours de maquillage sur-mesure.",
      cta: 'Réserver une prestation',
      image: IMG_REGARD,
    }),
    introGeo({
      quote: 'Le regard change tout, sans en faire trop.',
      text:
        "La beauté du regard à l'institut Emmanuelle Esthétique de <strong>Palézieux-Gare</strong> se pense en <strong>retouches discrètes</strong>, pas en transformation. Sourcils dessinés à la <strong>cire ou à la pince</strong>, <strong>teinture végétale</strong>, <strong>rehaussement de cils</strong> pour un effet mascara permanent 6 semaines, et <strong>cours de maquillage sur-mesure</strong> pour apprendre les bons gestes chez soi.",
      image: IMG_REGARD,
    }),
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'Les prestations',
        title: 'Choisissez',
        bg_color: CREME,
        cards: [
          {
            icon: '✏️',
            title: 'Mise en forme des sourcils',
            description: 'Dessin sur-mesure à la cire ou à la pince — CHF 35 · 30 min.',
            link_text: 'Voir la fiche',
            link_href: '/sourcils-mise-en-forme-palezieux',
          },
          {
            icon: '🎨',
            title: 'Teinture cils & sourcils',
            description: 'Teinture végétale douce, effet 4 à 6 semaines — dès CHF 30.',
            link_text: 'Voir la fiche',
            link_href: '/teinture-cils-sourcils-palezieux',
          },
          {
            icon: '💫',
            title: 'Rehaussement de cils',
            description: 'Effet mascara permanent, dure 6 à 8 semaines — CHF 85 · 1 h.',
            link_text: 'Voir la fiche',
            link_href: '/rehaussement-cils-palezieux',
          },
          {
            icon: '💄',
            title: 'Cours de maquillage',
            description: "Apprendre les gestes qui vous vont, avec vos produits — CHF 110 · 1 h 30.",
            link_text: 'Voir la fiche',
            link_href: '/cours-de-maquillage-palezieux',
          },
        ],
      },
    },
    ctaFinal({ title: 'Réserver une prestation regard' }),
  ],
};

const SOURCILS: SeoPageSeed = {
  title: 'Mise en forme des sourcils',
  slug: 'sourcils-mise-en-forme-palezieux',
  published: true,
  seo: {
    title: 'Sourcils · Mise en forme · Palézieux-Gare (Vaud)',
    description:
      "Dessin sur-mesure des sourcils à la cire ou à la pince, à Palézieux-Gare. 30 minutes, CHF 35. Sur rendez-vous.",
    og_title: 'Mise en forme des sourcils à Palézieux-Gare',
    og_description:
      "Un dessin qui respecte votre visage, sans caricature. 30 min à Palézieux-Gare.",
    keywords:
      'sourcils Palézieux, épilation sourcils Vaud, mise en forme sourcils Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Beauté du regard · Palézieux-Gare',
      title: 'Mise en forme des sourcils',
      description:
        "Un dessin sur-mesure, à la cire ou à la pince, pour un regard structuré sans effet artificiel. 30 minutes.",
      cta: 'Réserver',
      image: IMG_REGARD,
    }),
    introGeo({
      quote: 'Le sourcil qui vous ressemble, pas celui d\'un tuto.',
      text:
        "La mise en forme des sourcils à <strong>Palézieux-Gare</strong> commence par un <strong>tracé personnalisé</strong> (règle et crayon blanc), puis une <strong>épilation à la cire</strong> ou à la <strong>pince</strong> selon votre peau. Objectif : <strong>respecter la forme naturelle</strong> et l'harmonie avec votre visage. Durée : <strong>30 minutes</strong>. Tarif : <strong>CHF 35</strong>.",
      image: IMG_REGARD,
    }),
    tarifBloc({
      title: 'Mise en forme — CHF 35',
      price: 'CHF 35',
      priceNote: '· 30 minutes',
      items: [
        'Tracé personnalisé au crayon blanc',
        'Épilation à la cire (ou pince au choix)',
        'Brossage & mise en forme',
        'Conseils repousse & entretien',
      ],
      cta: 'Réserver',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "À quelle fréquence entretenir les sourcils ?",
          answer:
            "Toutes les 4 à 5 semaines pour garder un dessin net. Entre deux, un simple brossage et quelques poils enlevés à la pince suffisent — je vous montre les gestes.",
        },
        {
          question: "Est-ce douloureux ?",
          answer:
            "Une petite sensation à la pose, pas plus. Si vous êtes très sensible, dites-le : on peut faire au fil ou à la pince uniquement.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver une mise en forme à Palézieux-Gare' }),
  ],
};

const TEINTURE: SeoPageSeed = {
  title: 'Teinture cils & sourcils',
  slug: 'teinture-cils-sourcils-palezieux',
  published: true,
  seo: {
    title: 'Teinture cils & sourcils · Palézieux-Gare (Vaud)',
    description:
      "Teinture végétale douce, effet 4 à 6 semaines. Cils, sourcils ou combo, à Palézieux-Gare. Dès CHF 30.",
    og_title: 'Teinture cils & sourcils à Palézieux-Gare',
    og_description:
      "Un regard souligné sans mascara, avec une teinture végétale douce. À Palézieux-Gare.",
    keywords:
      'teinture cils Palézieux, teinture sourcils Vaud, teinture végétale Palézieux-Gare, cils teints Broye',
  },
  sections: [
    hero({
      eyebrow: 'Beauté du regard · Palézieux-Gare',
      title: 'Teinture cils & sourcils',
      description:
        "Une teinture végétale douce pour un regard souligné, effet 4 à 6 semaines. À Palézieux-Gare.",
      cta: 'Réserver',
      image: IMG_REGARD,
    }),
    introGeo({
      quote: 'Un regard souligné dès le réveil.',
      text:
        "La teinture cils & sourcils à <strong>Palézieux-Gare</strong> utilise une <strong>teinture végétale douce</strong>, respectueuse des peaux sensibles. Sourcils seuls : <strong>CHF 30</strong>. Cils seuls : <strong>CHF 40</strong>. Les deux (combo) : <strong>CHF 60</strong>. Durée totale : <strong>30 à 45 minutes</strong>. L'effet tient <strong>4 à 6 semaines</strong>.",
      image: IMG_REGARD,
    }),
    tarifBloc({
      title: 'Teinture — dès CHF 30',
      price: 'CHF 30',
      priceNote: '· Sourcils seuls · Cils : CHF 40 · Les deux : CHF 60',
      items: [
        'Teinture végétale douce',
        'Compatible peaux sensibles',
        'Effet 4 à 6 semaines',
        'Peut être combinée à une mise en forme',
      ],
      cta: 'Réserver',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "La teinture convient-elle à toutes les peaux ?",
          answer:
            "La teinture végétale utilisée est douce et compatible avec la plupart des peaux sensibles. Un test préalable est fait sur le poignet pour les peaux très réactives.",
        },
        {
          question: "Puis-je choisir la couleur ?",
          answer:
            "Oui, on choisit ensemble entre plusieurs nuances (blond doré, châtain, brun, noir intense). L'idée est de rester à un ou deux tons proches de votre couleur naturelle pour un rendu discret.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver une teinture à Palézieux-Gare' }),
  ],
};

const REHAUSSEMENT: SeoPageSeed = {
  title: 'Rehaussement de cils',
  slug: 'rehaussement-cils-palezieux',
  published: true,
  seo: {
    title: 'Rehaussement de cils · Palézieux-Gare (Vaud)',
    description:
      "Cils recourbés vers le haut, effet mascara permanent 6 à 8 semaines. À Palézieux-Gare. 1 h, CHF 85.",
    og_title: 'Rehaussement de cils à Palézieux-Gare',
    og_description:
      "Un regard ouvert et rehaussé sans extension. Effet 6 à 8 semaines à Palézieux-Gare.",
    keywords:
      'rehaussement de cils Palézieux, lash lift Vaud, cils rehaussés Palézieux-Gare, mascara permanent',
  },
  sections: [
    hero({
      eyebrow: 'Beauté du regard · Palézieux-Gare',
      title: 'Rehaussement de cils (lash lift)',
      description:
        "Un rehaussement doux qui recourbe vos cils vers le haut. Effet mascara permanent 6 à 8 semaines. 1 heure.",
      cta: 'Réserver',
      image: IMG_REGARD,
    }),
    introGeo({
      quote: 'Le mascara, en effet permanent.',
      text:
        "Le rehaussement de cils à <strong>Palézieux-Gare</strong> (aussi appelé <em>lash lift</em>) recourbe <strong>vos propres cils vers le haut</strong>, sans extension ni faux cils. Un soin nourrissant à la kératine est appliqué pour renforcer les cils. Souvent combiné à une <strong>teinture</strong> pour un effet complet. Durée : <strong>1 heure</strong>. Tarif : <strong>CHF 85</strong> (avec teinture : CHF 105).",
      image: IMG_REGARD,
    }),
    tarifBloc({
      title: 'Rehaussement de cils — CHF 85',
      price: 'CHF 85',
      priceNote: '· 1 heure · Avec teinture : CHF 105',
      items: [
        'Recourbe vos cils naturels',
        'Effet mascara permanent',
        "Soin kératine incluse",
        'Effet 6 à 8 semaines',
        'Sans extension, sans faux cils',
      ],
      cta: 'Réserver',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "Le rehaussement abîme-t-il les cils ?",
          answer:
            "Non, à condition d'utiliser des produits doux et de respecter les temps de pose. Le soin à la kératine appliqué en fin de prestation nourrit et renforce le cil.",
        },
        {
          question: "Puis-je me maquiller les yeux normalement après ?",
          answer:
            "Oui, dès le lendemain. Évitez le démaquillant huileux les 48 premières heures pour ne pas fragiliser la courbure.",
        },
        {
          question: "Puis-je porter des extensions par la suite ?",
          answer:
            "Il faut attendre 6 à 8 semaines pour que la courbure disparaisse, ou attendre que les cils se renouvellent complètement.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver un rehaussement à Palézieux-Gare' }),
  ],
};

const COURS_MAQUILLAGE: SeoPageSeed = {
  title: 'Cours de maquillage',
  slug: 'cours-de-maquillage-palezieux',
  published: true,
  seo: {
    title: 'Cours de maquillage sur-mesure · Palézieux-Gare',
    description:
      "Apprenez les gestes qui vous vont, avec vos propres produits. Cours individuel à Palézieux-Gare, 1 h 30, CHF 110.",
    og_title: 'Cours de maquillage à Palézieux-Gare — sur-mesure',
    og_description:
      "Un cours individuel, avec vos produits, pour un maquillage qui vous ressemble. À Palézieux-Gare.",
    keywords:
      'cours maquillage Palézieux, apprendre maquillage Vaud, cours individuel maquillage Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Beauté du regard · Palézieux-Gare',
      title: 'Cours de maquillage sur-mesure',
      description:
        "Un cours individuel, avec vos propres produits, pour apprendre les gestes qui vous vont. 1 h 30 à Palézieux-Gare.",
      cta: 'Réserver un cours',
      image: IMG_REGARD,
    }),
    introGeo({
      quote: 'Le maquillage qui vous ressemble, à votre rythme.',
      text:
        "Le cours de maquillage à <strong>Palézieux-Gare</strong> est <strong>individuel</strong>, avec <strong>vos propres produits</strong>. On analyse votre visage (forme, teint, atouts), on trie votre trousse, et on refait un maquillage complet ensemble — vous tenez le pinceau. À la fin, vous savez faire votre <strong>look du jour en 5 minutes</strong>. Durée : <strong>1 h 30</strong>. Tarif : <strong>CHF 110</strong>.",
      image: IMG_REGARD,
    }),
    tarifBloc({
      title: 'Cours de maquillage — CHF 110',
      price: 'CHF 110',
      priceNote: '· 1 h 30 · Individuel',
      items: [
        'Analyse morphologique du visage',
        'Tri de votre trousse à maquillage',
        'Vous tenez le pinceau — pas moi',
        'Fiche récapitulative à emporter',
        "Look 'tous les jours' + look 'sortie'",
      ],
      cta: 'Réserver un cours',
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "Faut-il apporter ses produits ?",
          answer:
            "Oui, le principe est d'apprendre avec ce que vous utilisez déjà. J'ai des produits Phytomer et de démonstration si besoin, mais l'idée est que vous repartiez avec des gestes reproductibles chez vous.",
        },
        {
          question: "Le cours convient-il à une débutante ?",
          answer:
            "Oui, c'est même souvent le meilleur moment pour venir. On commence par les bases (teint, sourcils, mise en valeur du regard) et on adapte au niveau souhaité.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver un cours de maquillage à Palézieux-Gare' }),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   CATÉGORIE — ÉPILATION AU SUCRE
   ────────────────────────────────────────────────────────────────────────*/

const EPILATION: SeoPageSeed = {
  title: 'Épilation à la cire au sucre',
  slug: 'epilation-sucre-palezieux',
  published: true,
  seo: {
    title: 'Épilation au sucre indolore · Palézieux-Gare (Vaud)',
    description:
      "Épilation à la pâte de sucre, quasi indolore, adaptée aux peaux sensibles. À Palézieux-Gare. Visage, corps, maillot.",
    og_title: 'Épilation au sucre à Palézieux-Gare — indolore',
    og_description:
      "Une pâte 100 % naturelle rincée à l'eau, qui respecte les peaux réactives. À Palézieux-Gare.",
    keywords:
      'épilation sucre Palézieux, épilation naturelle Vaud, épilation indolore Palézieux-Gare, épilation maillot Broye',
  },
  sections: [
    hero({
      eyebrow: 'Silo — épilation · Palézieux-Gare',
      title: 'Épilation à la cire au sucre',
      description:
        "Une pâte 100 % naturelle (sucre, citron, eau), tiède, qui s'enlève à l'eau. Quasi indolore, respectueuse des peaux sensibles.",
      cta: 'Réserver une épilation',
      image: IMG_EPILATION,
    }),
    introGeo({
      quote: 'La méthode douce, même pour les zones sensibles.',
      text:
        "L'épilation à la <strong>pâte de sucre</strong> à <strong>Palézieux-Gare</strong> est une méthode <strong>100 % naturelle</strong> (sucre, citron, eau), tiède, qui <strong>s'enlève à l'eau</strong>. Elle arrache le poil dans le sens de la pousse — <strong>quasi indolore</strong>, sans irritation, adaptée aux <strong>peaux sensibles, réactives ou sujettes aux poils incarnés</strong>. Toutes les zones : <strong>visage, aisselles, maillot, jambes</strong>.",
      image: IMG_EPILATION,
    }),
    {
      type: 'pricing_2',
      data: {
        theme: 'light',
        eyebrow: 'Tarifs indicatifs',
        title: 'Chaque zone, un tarif clair',
        bg_color: CREME,
        cards: [
          {
            title: 'Lèvre supérieure',
            price: 'CHF 15',
            price_note: '· 10 min',
            items: ['Sans irritation', 'Sans rougeur durable'],
            cta_text: 'Réserver',
            cta_href: RESA_HREF,
          },
          {
            title: 'Aisselles',
            price: 'CHF 25',
            price_note: '· 15 min',
            items: ['Peau douce sans folliculite', 'Idéal peaux réactives'],
            cta_text: 'Réserver',
            cta_href: RESA_HREF,
          },
          {
            title: 'Maillot classique',
            price: 'CHF 40',
            price_note: '· 20 min · Intégral : CHF 60',
            items: ['Moins de poils incarnés', 'Peau apaisée à la sortie'],
            cta_text: 'Réserver',
            cta_href: RESA_HREF,
          },
          {
            title: 'Demi-jambes',
            price: 'CHF 45',
            price_note: '· 30 min · Complètes : CHF 65',
            items: ['Épilation lente et propre', 'Repousse espacée'],
            cta_text: 'Réserver',
            cta_href: RESA_HREF,
          },
        ],
      },
    },
    faqLocale({
      title: 'Questions fréquentes sur l\'épilation au sucre',
      cards: [
        {
          question: "L'épilation au sucre est-elle vraiment indolore ?",
          answer:
            "Quasi indolore par rapport à la cire chaude classique : la pâte de sucre arrache le poil dans le sens de la pousse (et non contre), donc sans traction violente. La première fois reste un peu inconfortable, mais infiniment moins que la cire chaude.",
        },
        {
          question: "Quelle longueur de poil faut-il avant l'épilation ?",
          answer:
            "Environ 2 à 5 mm (soit 10 à 15 jours de repousse). Trop court, la pâte n'accroche pas ; trop long, c'est inconfortable. Si vous vous rasez, laissez pousser 2 à 3 semaines avant la première venue.",
        },
        {
          question: "L'épilation au sucre convient-elle à une femme enceinte ?",
          answer:
            "Oui, sans problème. La méthode est douce, la pâte est comestible (sucre, citron, eau) — aucun produit chimique. Signalez juste votre grossesse à la prise de rendez-vous.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver une épilation à Palézieux-Gare' }),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   CATÉGORIE — ATELIERS D'AUTO-SOIN
   ────────────────────────────────────────────────────────────────────────*/

const ATELIERS_HUB: SeoPageSeed = {
  title: "Ateliers d'auto-soin",
  slug: 'ateliers-bien-etre-palezieux',
  published: true,
  seo: {
    title: "Ateliers Gua Sha & Glowing Face · Palézieux-Gare",
    description:
      "Ateliers d'auto-soin en petit comité à Palézieux-Gare : Gua Sha, Glowing Face, auto-massage. Apprendre à prendre soin de soi.",
    og_title: "Ateliers d'auto-soin à Palézieux-Gare — Emmanuelle Esthétique",
    og_description:
      "Apprendre les gestes qui prolongent le soin, en petit comité, à Palézieux-Gare (Vaud).",
    keywords:
      'atelier Gua Sha Palézieux, Glowing Face Vaud, atelier auto-massage Palézieux-Gare, cours beauté femme Broye',
  },
  sections: [
    hero({
      eyebrow: 'Silo — ateliers · Palézieux-Gare',
      title: "Ateliers d'auto-soin",
      description:
        "Apprenez à prendre soin de votre peau et de votre corps en toute autonomie. En petit comité (4 à 6 femmes), dans une ambiance conviviale.",
      cta: 'Voir le calendrier',
      image: IMG_ATELIER,
    }),
    introGeo({
      quote: 'Prolonger le soin, chez soi.',
      text:
        "Les ateliers d'Emmanuelle Esthétique à <strong>Palézieux-Gare</strong> apprennent les <strong>gestes qui prolongent le soin</strong> : Gua Sha du visage, auto-massage, routine Glowing Face. En <strong>petit comité (4 à 6 femmes maximum)</strong>, dans une ambiance conviviale. Idéal aussi pour un cadeau à plusieurs, entre amies ou entre collègues de la région (Palézieux, Oron, Châtel-St-Denis, Vevey).",
      image: IMG_ATELIER,
    }),
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'Les ateliers',
        title: 'Deux formats',
        bg_color: CREME,
        cards: [
          {
            icon: '🀄',
            title: 'Atelier Gua Sha',
            description:
              "Apprendre l'auto-massage au Gua Sha : gestes, pressions, pierre à choisir. 2 heures. À Palézieux-Gare.",
            link_text: 'Voir la fiche',
            link_href: '/atelier-gua-sha-palezieux',
          },
          {
            icon: '✨',
            title: 'Atelier Glowing Face',
            description:
              "Une routine visage complète pour un éclat quotidien : lecture d'étiquettes, gestes, ordre des produits. 2 h 30.",
            link_text: 'Voir la fiche',
            link_href: '/atelier-glowing-face-palezieux',
          },
        ],
      },
    },
    ctaFinal({ title: 'Se renseigner sur les ateliers' }),
  ],
};

const ATELIER_GUASHA: SeoPageSeed = {
  title: 'Atelier Gua Sha',
  slug: 'atelier-gua-sha-palezieux',
  published: true,
  seo: {
    title: 'Atelier Gua Sha visage · Palézieux-Gare (Vaud)',
    description:
      "Atelier d'auto-massage au Gua Sha à Palézieux-Gare. 2 h en petit comité. Pierre offerte. CHF 90.",
    og_title: 'Atelier Gua Sha à Palézieux-Gare',
    og_description:
      "Apprendre les gestes du Gua Sha visage en petit comité, à Palézieux-Gare (Vaud).",
    keywords:
      'atelier Gua Sha Palézieux, cours Gua Sha Vaud, atelier auto-massage visage Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Atelier · Palézieux-Gare',
      title: 'Atelier Gua Sha visage',
      description:
        "Apprendre les gestes du Gua Sha, pour un massage manuel visage à la maison. 2 heures, en petit comité, pierre offerte.",
      cta: "S'inscrire",
      image: IMG_ATELIER,
    }),
    introGeo({
      quote: 'Le geste japonais, appris en 2 heures.',
      text:
        "L'atelier Gua Sha à <strong>Palézieux-Gare</strong> se déroule en groupe de <strong>4 à 6 femmes</strong>, sur <strong>2 heures</strong>. Il comprend : théorie brève (histoire, bénéfices, contre-indications), <strong>démonstration complète</strong>, pratique guidée sur soi, <strong>pierre en jade ou quartz rose offerte</strong>, thé et échange. Tarif : <strong>CHF 90</strong> par personne (pierre incluse).",
      image: IMG_ATELIER,
    }),
    tarifBloc({
      title: 'Atelier Gua Sha — CHF 90',
      price: 'CHF 90',
      priceNote: '· 2 h · Pierre offerte · 4 à 6 personnes',
      items: [
        'Théorie & bénéfices',
        'Démonstration complète',
        'Pratique guidée sur soi',
        'Pierre en jade ou quartz rose offerte',
        'Fiche pratique à emporter',
        'Thé & échanges',
      ],
      cta: "S'inscrire à un atelier",
    }),
    faqLocale({
      title: 'Questions fréquentes',
      cards: [
        {
          question: "Faut-il déjà connaître le Gua Sha ?",
          answer:
            "Non. L'atelier est pensé pour les débutantes. On part de zéro et on apprend les gestes de base pour une routine de 5 à 10 minutes chez soi.",
        },
        {
          question: "Combien de participantes ?",
          answer:
            "Entre 4 et 6, jamais plus. C'est ce qui permet de corriger les gestes individuellement.",
        },
        {
          question: "Le Gua Sha est-il contre-indiqué pour ma peau ?",
          answer:
            "Il l'est en cas de couperose sévère, rosacée en poussée, acné inflammatoire ou peau lésée. On en parle à l'inscription et j'ajuste si besoin (pression, zones).",
        },
      ],
    }),
    ctaFinal({ title: "S'inscrire à l'atelier Gua Sha" }),
  ],
};

const ATELIER_GLOWING: SeoPageSeed = {
  title: 'Atelier Glowing Face',
  slug: 'atelier-glowing-face-palezieux',
  published: true,
  seo: {
    title: 'Atelier Glowing Face · Palézieux-Gare (Vaud)',
    description:
      "Atelier routine visage complète à Palézieux-Gare. 2 h 30, en petit comité. Lecture d'étiquettes, gestes, ordre des produits.",
    og_title: 'Atelier Glowing Face à Palézieux-Gare',
    og_description:
      "Construire une routine visage qui tient dans le temps, adaptée à votre peau. À Palézieux-Gare.",
    keywords:
      'atelier Glowing Face Palézieux, atelier routine visage Vaud, cours cosmétique naturelle Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Atelier · Palézieux-Gare',
      title: 'Atelier Glowing Face',
      description:
        "Une routine visage complète pour un éclat au quotidien : lecture d'étiquettes, gestes essentiels, ordre des produits. 2 h 30 en petit comité.",
      cta: "S'inscrire",
      image: IMG_ATELIER,
    }),
    introGeo({
      quote: 'La routine qui tient dans le temps.',
      text:
        "L'atelier Glowing Face à <strong>Palézieux-Gare</strong> apprend à <strong>construire une routine visage adaptée à votre peau</strong> : <strong>lecture d'étiquettes cosmétiques</strong>, <strong>ordre d'application des produits</strong>, <strong>gestes qui font la différence</strong> (nettoyage, sérum, massage), <strong>choix des textures</strong> pour votre saison de vie. 2 h 30 en groupe de 4 à 6. Tarif : <strong>CHF 110</strong>.",
      image: IMG_ATELIER,
    }),
    tarifBloc({
      title: 'Atelier Glowing Face — CHF 110',
      price: 'CHF 110',
      priceNote: '· 2 h 30 · 4 à 6 personnes',
      items: [
        'Lecture d\'étiquettes cosmétiques',
        'Ordre d\'application des produits',
        'Gestes essentiels du soin',
        'Adaptation à votre type de peau',
        'Échantillons Phytomer à emporter',
        'Fiche récapitulative',
      ],
      cta: "S'inscrire",
    }),
    ctaFinal({ title: "S'inscrire à l'atelier Glowing Face" }),
  ],
};

const BON_CADEAU: SeoPageSeed = {
  title: 'Bon cadeau',
  slug: 'bon-cadeau',
  published: true,
  seo: {
    title: 'Bon cadeau · Emmanuelle Esthétique Palézieux-Gare',
    description:
      "Offrez une parenthèse de douceur à Palézieux-Gare : bon cadeau du montant ou du soin de votre choix, valable 60 mois.",
    og_title: 'Offrir un bon cadeau — Institut Palézieux-Gare',
    og_description:
      "Un bon nominatif pour une bulle de détente à Palézieux-Gare. Livraison PDF ou papier.",
    keywords:
      'bon cadeau Emmanuelle Esthétique, cadeau esthétique Palézieux, cadeau bien-être Vaud, chèque cadeau institut Palézieux-Gare',
  },
  sections: [
    hero({
      eyebrow: 'Bon cadeau · Palézieux-Gare',
      title: 'Offrez une parenthèse de douceur',
      description:
        "Un bon cadeau du montant de votre choix, ou d'un soin précis. Valable 60 mois. Livré en PDF ou dans une jolie enveloppe.",
      cta: 'Commander un bon',
      // Gouttes d'eau sur pétales — cadeau + soin, sans surcharge.
      image: IMG_MARINE_GOUTTES,
      bgColor: SAGE_BG,
    }),
    introGeo({
      quote: 'Le cadeau qui fait vraiment plaisir.',
      text:
        "Le bon cadeau Emmanuelle Esthétique à <strong>Palézieux-Gare</strong> est <strong>nominatif</strong>, <strong>valable 60 mois</strong> (loi suisse : les bons sont des créances ordinaires, prescription 10 ans), et peut couvrir <strong>un montant libre</strong> ou <strong>un soin précis</strong> (soin visage, Head Spa, massage, cure). Livraison : <strong>PDF par e-mail</strong> ou <strong>enveloppe papier</strong> à retirer à l'institut.",
      image: IMG_COCON,
      bgColor: '#FFFFFF',
    }),
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'Trois façons d\'offrir',
        title: 'Choisir le bon cadeau',
        bg_color: CREME,
        cards: [
          {
            icon: '💰',
            title: 'Un montant libre',
            description:
              "Choisissez le montant qui vous convient (dès CHF 50). La bénéficiaire choisit le soin qui lui fait envie.",
          },
          {
            icon: '💆‍♀️',
            title: 'Un soin précis',
            description:
              "Offrez un soin visage, un Head Spa, un massage ou une cure de 3 soins. Le bon indique le soin choisi et sa durée.",
          },
          {
            icon: '📮',
            title: 'PDF ou papier',
            description:
              "Livré en PDF dans les 24 h ou dans une jolie enveloppe cartonnée à retirer à l'institut de Palézieux-Gare.",
          },
        ],
      },
    },
    ctaFinal({
      title: 'Commander un bon cadeau',
      description:
        "Écrivez-moi le montant ou le soin souhaité, le nom de la bénéficiaire, et le mode de livraison — je vous envoie le bon dans les 24 h.",
    }),
  ],
};

const MENTIONS: SeoPageSeed = {
  title: 'Mentions légales',
  slug: 'mentions-legales',
  published: true,
  seo: {
    title: 'Mentions légales · Emmanuelle Esthétique',
    description: "Mentions légales du site emmanuelle-esthetique.ch : éditeur, hébergement, données personnelles, cookies.",
    keywords: 'mentions légales Emmanuelle Esthétique',
  },
  sections: [
    hero({
      eyebrow: 'Informations légales',
      title: 'Mentions légales',
      description:
        "Éditeur du site, hébergement, protection des données personnelles.",
      cta: 'Retour à l\'accueil',
      ctaHref: '/',
      bgColor: CREME,
    }),
    {
      type: 'text_1',
      data: {
        theme: 'light',
        title: 'Éditeur',
        content:
          '<p><strong>Emmanuelle Esthétique</strong><br>Emmanuelle Le Tousse, esthéticienne indépendante<br>Chemin de la Marouette 19<br>1607 Palézieux (Vaud, Suisse)<br>E-mail : e.letousse@gmail.com<br>Téléphone : +41 78 823 66 12</p>' +
          '<h2>Hébergement</h2>' +
          '<p>Le site est hébergé par Netlify Inc., 512 2nd Street, San Francisco, CA 94107 (États-Unis).</p>' +
          '<h2>Protection des données personnelles</h2>' +
          '<p>Les données saisies dans le formulaire de contact (nom, e-mail, message) sont utilisées uniquement pour répondre à votre demande. Elles ne sont ni vendues, ni cédées à un tiers, et sont supprimées après 12 mois d\'inactivité.</p>' +
          '<p>Conformément à la Loi fédérale suisse sur la protection des données (LPD), vous disposez d\'un droit d\'accès, de rectification et de suppression de vos données. Pour l\'exercer, écrivez à e.letousse@gmail.com.</p>' +
          '<h2>Cookies</h2>' +
          '<p>Ce site utilise uniquement des cookies techniques nécessaires à son fonctionnement (session admin). Aucun cookie de tracking publicitaire n\'est déposé.</p>' +
          '<h2>Propriété intellectuelle</h2>' +
          '<p>Les textes, photos et graphismes de ce site sont la propriété d\'Emmanuelle Esthétique. Toute reproduction, même partielle, est interdite sans autorisation écrite.</p>',
      },
    },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   Refonte de la page "soins" existante (hub qui liste tous les silos)
   ────────────────────────────────────────────────────────────────────────*/

const SOINS_HUB: SeoPageSeed = {
  title: 'Tous les soins',
  slug: 'soins',
  published: true,
  seo: {
    title: 'Tous les soins · Institut Palézieux-Gare (Vaud)',
    description:
      "Soins du visage Phytomer, massages, Head Spa, beauté du regard, épilation au sucre : tous les soins à Palézieux-Gare.",
    og_title: 'Tous les soins à Palézieux-Gare',
    og_description:
      "Panorama complet des prestations d'Emmanuelle Esthétique à Palézieux-Gare, canton de Vaud.",
    keywords:
      'soins Palézieux, esthéticienne Palézieux-Gare, institut Vaud soins visage massage épilation',
  },
  sections: [
    hero({
      eyebrow: 'Institut Emmanuelle · Palézieux-Gare',
      title: 'Tous les soins, en un coup d\'œil',
      description:
        "Cinq univers pour prendre soin de vous à Palézieux-Gare : visage, corps, regard, épilation, ateliers. Cliquez pour découvrir chaque protocole.",
      cta: 'Prendre rendez-vous',
      image: IMG_VISAGE,
      bgColor: CREME,
    }),
    {
      type: 'features_2',
      data: {
        theme: 'light',
        title: 'Les cinq silos de soins',
        bg_color: '#FFFFFF',
        cards: [
          {
            icon: '',
            icon_image: IMG_VISAGE,
            title: 'Soins du visage',
            description:
              "Soin signature, anti-âge, peau sensible. Rituels Phytomer sur-mesure.",
            link_text: 'Voir les soins visage',
            link_href: '/soins-visage-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_MASSAGE,
            title: 'Soins du corps',
            description:
              "Massage relaxant aux huiles chaudes et Head Spa. Souffler, dormir mieux.",
            link_text: 'Voir les massages',
            link_href: '/soins-corps-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_REGARD,
            title: 'Beauté du regard',
            description:
              "Sourcils, teinture, rehaussement de cils, cours de maquillage.",
            link_text: 'Voir la beauté du regard',
            link_href: '/beaute-du-regard-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_EPILATION,
            title: 'Épilation au sucre',
            description:
              "Cire au sucre, quasi indolore, pour toutes les zones — visage, aisselles, maillot, jambes.",
            link_text: 'Voir l\'épilation',
            link_href: '/epilation-sucre-palezieux',
          },
          {
            icon: '',
            icon_image: IMG_ATELIER,
            title: 'Ateliers d\'auto-soin',
            description:
              "Gua Sha et Glowing Face en petit comité, à Palézieux-Gare.",
            link_text: 'Voir les ateliers',
            link_href: '/ateliers-bien-etre-palezieux',
          },
          {
            icon: '🎁',
            title: 'Bons cadeaux',
            description:
              "Offrez une parenthèse de douceur à quelqu'un que vous aimez.",
            link_text: 'Offrir un bon',
            link_href: '/bon-cadeau',
          },
        ],
      },
    },
    faqLocale({
      title: 'Avant votre premier rendez-vous à Palézieux-Gare',
      cards: [
        {
          question: "Comment se passe une première visite ?",
          answer:
            "Vous êtes accueillie dans un cocon privé à Palézieux-Gare. On échange 10 minutes sur votre peau, vos habitudes et ce qui vous amène. Le soin est ensuite adapté à ce que nous avons vu ensemble. Comptez 30 minutes de plus que la durée annoncée du soin.",
        },
        {
          question: "Peut-on venir sans jamais être allée en institut ?",
          answer:
            "Bien sûr — c'est même souvent l'occasion parfaite. Aucun jugement, aucune vente forcée à la sortie. On part de zéro et on avance à votre rythme.",
        },
        {
          question: "Comment prendre rendez-vous ?",
          answer:
            "Uniquement sur rendez-vous et réservé aux femmes, via le formulaire de contact du site. Réponse sous 24 h. Créneaux 10 h ou 14 h, en semaine comme le samedi.",
        },
      ],
    }),
    ctaFinal({ title: 'Réserver votre soin à Palézieux-Gare' }),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   PAGE MARQUE — PHYTOMER (cosmétique marine, partenaire soin du visage)
   ────────────────────────────────────────────────────────────────────────*/

const PHYTOMER: SeoPageSeed = {
  title: 'Phytomer — cosmétique marine',
  slug: 'phytomer',
  published: true,
  seo: {
    title: 'Phytomer à Palézieux · La cosmétique marine choisie par l\'institut',
    description:
      "Pourquoi Emmanuelle Esthétique a choisi Phytomer, pionnier breton de la cosmétique marine, pour tous ses soins du visage à Palézieux-Gare.",
    og_title: 'Phytomer — la cosmétique marine d\'Emmanuelle Esthétique',
    og_description:
      "Une maison familiale bretonne, trois générations de savoir-faire, l'actif OLIGOMER® et des protocoles réservés aux plus grands spas — à Palézieux-Gare.",
    keywords:
      'Phytomer Palézieux, cosmétique marine Vaud, OLIGOMER Phytomer, soin visage Phytomer Suisse, institut Phytomer Broye',
  },
  sections: [
    hero({
      eyebrow: 'Notre partenaire de soin · Cosmétique marine',
      title: 'La force de la mer, l\'expertise d\'un institut',
      description:
        "Chez Emmanuelle Esthétique, chaque soin du visage est signé Phytomer, pionnier breton de la cosmétique marine. Cinquante ans de savoir-faire familial, des actifs marins issus de la baie du Mont-Saint-Michel, et des protocoles réservés aux instituts d'exception — la même expertise que dans les plus grands spas du monde, dans un cocon à Palézieux-Gare.",
      cta: 'Réserver un soin visage',
      ctaHref: '/soins-visage-palezieux',
      image: IMG_VISAGE,
      bgColor: SAGE_BG,
    }),
    introGeo({
      eyebrow: 'En bref',
      quote: 'Pourquoi la mer ? Parce qu\'elle parle à la peau.',
      text:
        "<strong>Phytomer</strong> est une maison familiale bretonne fondée il y a 50 ans, spécialisée dans les <strong>cosmétiques marins</strong>. Ses laboratoires cultivent leurs propres algues et plantes marines au bord de la <strong>baie du Mont-Saint-Michel</strong>, selon des méthodes éco-responsables — algues biologiques, sauvages ou de culture contrôlée. C'est la marque que j'ai choisie pour <strong>tous les soins du visage</strong> d'Emmanuelle Esthétique à Palézieux-Gare : douceur des textures, exigence des formulations, résultats visibles dès la première séance.",
      image: IMG_COCON,
      imagePosition: 'right',
      bgColor: '#FFFFFF',
    }),
    {
      type: 'text_image_1',
      data: {
        theme: 'light',
        eyebrow: 'L\'histoire',
        title: 'Trois générations, une même passion',
        bg_color: CREME,
        ratio: 'third',
        image_position: 'right',
        image_url: 'https://images.pexels.com/photos/1001682/pexels-photo-1001682.jpeg',
        image_alt: 'Baie du Mont-Saint-Michel, berceau des cosmétiques marins Phytomer',
        content:
          '<p>Phytomer, c\'est l\'aventure de <strong>trois générations</strong> de passionnés animés par une même vision : métamorphoser les richesses de l\'océan en soins d\'exception.</p>' +
          '<p>Ancrée au cœur de la <strong>Bretagne</strong>, cette maison familiale conçoit ses produits <strong>au bord de la baie du Mont-Saint-Michel</strong>. Les ingrédients marins qu\'elle utilise y sont précieux, bio, sauvages ou cultivés selon des méthodes rigoureusement <strong>éco-responsables</strong>.</p>' +
          '<p>Cinquante ans plus tard, la marque reste indépendante et familiale — une rareté dans le monde de la cosmétique, et l\'une des raisons pour lesquelles je lui confie la peau de mes clientes.</p>',
      },
    },
    protocole({
      title: 'La force vitale de la mer, au service de votre peau',
      bgColor: '#FFFFFF',
      cards: [
        {
          title: 'Une symbiose biologique',
          description:
            "L'eau de mer partage une composition minérale très proche de celle du plasma sanguin. Elle est reconnue par nos cellules et fournit à la peau les éléments essentiels à son éclat et à sa santé — en douceur, sans forcer.",
        },
        {
          title: 'L\'actif signature OLIGOMER®',
          description:
            "Concentré d'eau de mer purifiée, cœur des rituels Phytomer. Il reminéralise, revitalise et recharge la peau en minéraux et oligo-éléments pour la fortifier en profondeur et lui redonner toute son énergie.",
        },
        {
          title: 'Des textures sensorielles',
          description:
            "Grâce à leur culture propre d'algues et de plantes marines, les chercheurs Phytomer développent des formules aux textures délicates. Le confort d'un soin qu'on a envie de refaire, sans compromis sur l'efficacité.",
        },
      ],
    }),
    {
      type: 'text_image_1',
      data: {
        theme: 'light',
        eyebrow: 'L\'expertise',
        title: 'Des gestes réservés aux plus grands spas',
        bg_color: SAGE_BG,
        ratio: 'third',
        image_position: 'left',
        image_url: IMG_VISAGE,
        image_alt: 'Soin du visage Phytomer prodigué à l\'institut Emmanuelle Esthétique à Palézieux-Gare',
        content:
          '<p>Depuis 50 ans, Phytomer imagine des <strong>protocoles manuels exclusifs</strong>, réservés aux spas et instituts d\'élite du monde entier. Le geste fait autant que la formule — chaque manœuvre, chaque enchaînement est pensé pour prolonger l\'effet des actifs marins.</p>' +
          '<p>En poussant la porte d\'Emmanuelle Esthétique à Palézieux-Gare, vous bénéficiez des <strong>mêmes gestuelles expertes et ressourçantes</strong> que celles dispensées dans les plus prestigieux établissements — à deux minutes de la gare CFF, dans un cocon confidentiel plutôt qu\'un grand spa.</p>' +
          '<p><a href="/soins-visage-palezieux">Découvrir les trois soins du visage de l\'institut →</a></p>',
      },
    },
    {
      type: 'features_2',
      data: {
        theme: 'light',
        eyebrow: 'L\'engagement',
        title: 'Une cosmétique qui respecte ce qu\'elle célèbre',
        description:
          "Prendre soin de vous implique de veiller sur notre environnement. Phytomer s'engage à chaque étape de sa production.",
        bg_color: '#FFFFFF',
        cards: [
          {
            icon: '🌱',
            title: 'Énergies renouvelables',
            description:
              "Les sites de production Phytomer fonctionnent en priorité à l'énergie renouvelable et privilégient les procédés de fabrication verts, à faible empreinte carbone.",
          },
          {
            icon: '💧',
            title: 'Jardins filtrants',
            description:
              "Les eaux issues des ateliers sont dépolluées naturellement par des jardins filtrants avant tout rejet — la mer qui inspire les formules est aussi celle qu'on protège.",
          },
          {
            icon: '♻️',
            title: 'Emballages recyclables',
            description:
              "Priorité absolue aux matériaux recyclables et à la réduction des suremballages. Un flacon Phytomer se pense de la formule à sa fin de vie.",
          },
        ],
      },
    },
    faqLocale({
      title: 'Vos questions sur les soins Phytomer',
      bgColor: CREME,
      cards: [
        {
          question: "Pourquoi avoir choisi Phytomer plutôt qu'une autre marque ?",
          answer:
            "Trois raisons : une maison familiale indépendante depuis 50 ans (pas un groupe coté), une expertise marine unique avec l'actif OLIGOMER®, et des textures que je trouve particulièrement sensorielles. Je teste chaque nouveau produit sur ma propre peau avant de le proposer à mes clientes.",
        },
        {
          question: "Les actifs marins conviennent-ils aux peaux sensibles ?",
          answer:
            "Oui, c'est même l'une de leurs forces. La composition minérale de l'eau de mer est proche de celle du plasma cutané, donc la peau la reconnaît. Phytomer propose une gamme dédiée aux peaux réactives — c'est celle que j'utilise pour le soin visage peau sensible à Palézieux-Gare.",
        },
        {
          question: "Puis-je racheter des produits Phytomer pour prolonger le soin à la maison ?",
          answer:
            "Oui. Après votre soin, je vous conseille une routine simple (2 à 3 produits) adaptée à votre peau. Aucune vente forcée : vous repartez avec le nom des références, et vous pouvez les commander plus tard si vous le souhaitez.",
        },
        {
          question: "Phytomer est-elle testée sur les animaux ?",
          answer:
            "Non. Comme l'ensemble des cosmétiques vendus en Europe, les produits Phytomer respectent l'interdiction des tests sur les animaux (règlement européen depuis 2013). La marque va plus loin en s'engageant sur la traçabilité et la culture responsable de ses actifs marins.",
        },
      ],
    }),
    ctaFinal({
      title: 'Découvrir un soin Phytomer à Palézieux-Gare',
      description:
        "Écrivez-moi le soin qui vous intéresse — signature, anti-âge ou peau sensible — et je vous propose deux créneaux. Réponse sous 24 h.",
    }),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   REGISTRE + FONCTION DE SEED
   ────────────────────────────────────────────────────────────────────────*/

export const EMMANUELLE_PAGES: SeoPageSeed[] = [
  HOME,
  SOINS_HUB,
  APROPOS,
  CONTACT,
  BON_CADEAU,
  MENTIONS,
  SOINS_VISAGE,
  SOIN_SIGNATURE,
  SOIN_ANTIAGE,
  SOIN_PEAU_SENSIBLE,
  SOINS_CORPS,
  MASSAGE_RELAXANT,
  HEAD_SPA,
  BEAUTE_REGARD,
  SOURCILS,
  TEINTURE,
  REHAUSSEMENT,
  COURS_MAQUILLAGE,
  EPILATION,
  ATELIERS_HUB,
  ATELIER_GUASHA,
  ATELIER_GLOWING,
  PHYTOMER,
];

/**
 * Peuple `dynamic_pages` avec toutes les pages Emmanuelle SEO.
 * Requiert un contexte authentifié (client admin ou service_role).
 * Upsert par slug : ne touche pas aux autres pages, met à jour celles listées.
 */
export async function seedEmmanuellePages(): Promise<{
  inserted: number;
  updated: number;
}> {
  let inserted = 0;
  let updated = 0;

  for (const page of EMMANUELLE_PAGES) {
    const { data: existing } = await supabase
      .from('dynamic_pages')
      .select('id')
      .eq('slug', page.slug)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('dynamic_pages')
        .update({
          title: page.title,
          sections: page.sections,
          published: page.published,
        })
        .eq('id', existing.id);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await supabase.from('dynamic_pages').insert({
        title: page.title,
        slug: page.slug,
        sections: page.sections,
        published: page.published,
      });
      if (error) throw error;
      inserted += 1;
    }
  }

  return { inserted, updated };
}

/**
 * Pousse les métadonnées SEO de chaque page dans `settings`
 * (les clés que `getPageMeta` sait lire : seo_pages_{slug}_title, …).
 */
export async function seedEmmanuelleSeoMeta(): Promise<number> {
  let count = 0;
  const rows: { key: string; value: string }[] = [];

  for (const page of EMMANUELLE_PAGES) {
    const p = `seo_pages_${page.slug}_`;
    rows.push({ key: `${p}title`, value: page.seo.title });
    rows.push({ key: `${p}description`, value: page.seo.description });
    if (page.seo.og_title) rows.push({ key: `${p}og_title`, value: page.seo.og_title });
    if (page.seo.og_description)
      rows.push({ key: `${p}og_description`, value: page.seo.og_description });
    if (page.seo.keywords) rows.push({ key: `${p}keywords`, value: page.seo.keywords });
  }

  // La home a en plus des clés `seo_home_*` (sans le préfixe seo_pages_)
  const home = EMMANUELLE_PAGES.find((p) => p.slug === 'home')!;
  rows.push({ key: 'seo_home_title', value: home.seo.title });
  rows.push({ key: 'seo_home_description', value: home.seo.description });
  if (home.seo.og_title) rows.push({ key: 'seo_home_og_title', value: home.seo.og_title });
  if (home.seo.og_description)
    rows.push({ key: 'seo_home_og_description', value: home.seo.og_description });
  if (home.seo.keywords) rows.push({ key: 'seo_home_keywords', value: home.seo.keywords });

  for (const row of rows) {
    const { error } = await supabase.from('settings').upsert(row, { onConflict: 'key' });
    if (error) throw error;
    count += 1;
  }
  return count;
}

/**
 * Écrit la navigation locale (menu principal du header) et divers
 * réglages business pour renforcer le JSON-LD (price range, job title).
 */
export async function seedEmmanuelleNavAndBusiness(): Promise<void> {
  const nav = JSON.stringify([
    { name: 'Accueil', path: '/' },
    { name: 'Soins visage', path: '/soins-visage-palezieux' },
    { name: 'Soins corps', path: '/soins-corps-palezieux' },
    { name: 'Beauté du regard', path: '/beaute-du-regard-palezieux' },
    { name: 'Épilation', path: '/epilation-sucre-palezieux' },
    { name: 'Ateliers', path: '/ateliers-bien-etre-palezieux' },
    { name: 'À propos', path: '/a-propos' },
    { name: 'Contact', path: '/contact' },
  ]);

  const rows = [
    { key: 'navigation_menu', value: nav },
    { key: 'business_job_title', value: 'Esthéticienne diplômée · Institut à domicile' },
    { key: 'business_price_range', value: 'CHF 30 – CHF 170' },
    // Zones desservies pour JSON-LD (lu par le layout amélioré)
    {
      key: 'business_area_served',
      value:
        'Palézieux-Gare, Palézieux-Village, Oron, Châtel-Saint-Denis, Chexbres, Puidoux, Rue, Bulle, Vevey, Lavaux, Broye',
    },
    // Horaires (schema.org)
    {
      key: 'business_opening_hours',
      value: JSON.stringify([
        { days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], opens: '09:00', closes: '19:00' },
      ]),
    },
    // Géolocalisation approximative de Palézieux-Gare (canton de Vaud)
    { key: 'business_geo_lat', value: '46.5445' },
    { key: 'business_geo_lng', value: '6.8380' },
    // Type Schema.org spécifique — meilleur signal Rich Results
    { key: 'business_schema_type', value: 'BeautySalon' },
    // Home register link (bouton "Prendre rendez-vous" du header)
    { key: 'header_register_link', value: '/contact' },
  ];

  for (const row of rows) {
    const { error } = await supabase.from('settings').upsert(row, { onConflict: 'key' });
    if (error) throw error;
  }
}
