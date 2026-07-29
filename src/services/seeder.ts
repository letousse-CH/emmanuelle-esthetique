import { supabase } from './supabase';
import type { PageSection } from '../components/pagebuilder/wireframes.config';

interface DefaultPageSeed {
  title: string;
  slug: string;
  sections: PageSection[];
  published: boolean;
}

// Palette Emmanuelle Esthétique (miroir des tokens `@theme` de src/index.css) —
// utilisée comme `bg_color` des sections pour alterner crème / blanc / lin.
const CREAM = "#FAF7F2";   // blanc cassé (fond principal)
const WHITE = "#FFFFFF";   // blanc pur
const LINEN = "#F1EAE0";   // lin
const SAND = "#EDE6DA";    // lin plus soutenu (bandeau)
const SAGE_DEEP = "#5E6B52"; // vert sauge profond (sections sombres)

const DEFAULT_PAGES: DefaultPageSeed[] = [
  {
    title: "Accueil",
    slug: "home",
    published: true,
    sections: [
      // ── 1. Hero ────────────────────────────────────────────────────────────
      {
        type: "hero_1",
        data: {
          theme: "light",
          bg_color: CREAM,
          eyebrow: "Institut à domicile · Palézieux",
          title: "Une parenthèse de douceur et de beauté",
          title_italic: "au cœur de Palézieux",
          description: "Soins du visage, Head Spa et ateliers bien-être personnalisés, dans un cocon à domicile pensé pour que vous n'ayez plus qu'une seule chose à faire : vous laisser aller.",
          cta_primary_text: "Réserver un soin",
          cta_primary_href: "/contact",
          cta_secondary_text: "Découvrir les soins",
          cta_secondary_href: "/soins",
          image_url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=1600",
          image_alt: "Ambiance cocooning : serviettes en coton, lumière naturelle et plantes vertes",
          image_opacity: 100,
          button_style: "green"
        }
      },

      // ── 2. Bandeau défilant ────────────────────────────────────────────────
      {
        type: "marquee_1",
        data: {
          items: [
            "Soins du visage",
            "Head Spa",
            "Massages relaxants",
            "Beauté du regard",
            "Ateliers Gua Sha",
            "Cosmétique naturelle"
          ],
          bg_color: SAND,
          text_color: "#7C8A6E",
          separator: "●",
          speed: "slow",
          italic: false
        }
      },

      // ── 3. Les 3 univers ───────────────────────────────────────────────────
      {
        type: "features_2",
        data: {
          theme: "light",
          bg_color: WHITE,
          eyebrow: "Les 3 univers",
          title: "Trois façons de prendre soin de vous",
          description: "Que vous veniez pour souffler une heure, pour apprendre les bons gestes ou pour faire plaisir à quelqu'un — il y a une porte d'entrée pour chacune.",
          cards: [
            {
              icon: "🌿",
              title: "Les soins",
              description: "Soins du visage et du corps doux et naturels, Head Spa, massages relaxants et beauté du regard. Chaque protocole est adapté à votre peau et à votre humeur du jour.",
              link_text: "Découvrir les soins",
              link_href: "/soins"
            },
            {
              icon: "🤲",
              title: "Les ateliers",
              description: "Apprenez à prendre soin de votre peau en toute autonomie : Gua Sha, auto-massage du visage, Glowing Face. En petit comité, dans une ambiance conviviale.",
              link_text: "Découvrir les ateliers",
              link_href: "/ateliers"
            },
            {
              icon: "🎁",
              title: "Bons cadeaux & produits",
              description: "Offrez une bulle de détente à quelqu'un que vous aimez, ou repartez avec les soins naturels que j'utilise en cabine.",
              link_text: "Offrir un bon cadeau",
              link_href: "/bon-cadeau"
            }
          ]
        }
      },

      // ── 4. À propos / le concept ───────────────────────────────────────────
      {
        type: "intro_1",
        data: {
          theme: "light",
          bg_color: CREAM,
          eyebrow: "Le concept",
          quote: "Bienvenue chez Emmanuelle",
          text: "Je vous accueille dans mon institut à domicile, à Palézieux. Un espace intime et apaisant, loin de l'agitation des grandes enseignes, pensé pour vous proposer une autre façon de prendre soin de vous : en douceur, en prenant le temps, et sans jamais aucun jugement.",
          cta_text: "Faire connaissance",
          cta_href: "/a-propos",
          image_url: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=1200",
          image_alt: "Soin du visage prodigué dans l'institut à domicile de Palézieux",
          image_position: "right"
        }
      },

      // ── 5. Témoignages ─────────────────────────────────────────────────────
      // ⚠️ PLACEHOLDER — ces avis sont des exemples de mise en page.
      // À remplacer par de vrais témoignages (ou avis Google) avant la mise en
      // ligne : publier des avis inventés serait trompeur pour les visiteuses.
      {
        type: "reviews_1",
        data: {
          theme: "light",
          bg_color: LINEN,
          eyebrow: "Témoignages",
          title: "Ce que disent",
          title_bold: "mes clientes",
          description: "Exemples de mise en page — à remplacer par de vrais avis avant la mise en ligne.",
          cards: [
            {
              name: "Exemple — avis à remplacer",
              date: "—",
              rating: 5,
              text: "Emplacement réservé à un témoignage authentique sur l'accueil et la douceur du soin. Remplacez ce texte depuis l'admin (section « Témoignages »)."
            },
            {
              name: "Exemple — avis à remplacer",
              date: "—",
              rating: 5,
              text: "Emplacement réservé à un témoignage sur le cadre à domicile, intime et chaleureux. Remplacez ce texte depuis l'admin."
            },
            {
              name: "Exemple — avis à remplacer",
              date: "—",
              rating: 5,
              text: "Emplacement réservé à un témoignage sur un atelier (Gua Sha, Glowing Face) et les gestes appris. Remplacez ce texte depuis l'admin."
            },
            {
              name: "Exemple — avis à remplacer",
              date: "—",
              rating: 5,
              text: "Emplacement réservé à un témoignage sur un massage ou un Head Spa. Remplacez ce texte depuis l'admin."
            }
          ]
        }
      },

      // ── 6. Bannière bon cadeau ─────────────────────────────────────────────
      {
        type: "cta_1",
        data: {
          theme: "dark",
          bg_color: SAGE_DEEP,
          eyebrow: "Bon cadeau",
          title: "Faites plaisir à vos proches",
          description: "Offrez un moment de relaxation dont on se souvient. Choisissez le montant ou le soin, commandez en ligne, et repartez avec un bon prêt à offrir.",
          cta_text: "Commander un bon cadeau",
          cta_href: "/bon-cadeau",
          button_style: "white"
        }
      },

      // ── 7. Infos pratiques & contact ───────────────────────────────────────
      {
        type: "text_image_1",
        data: {
          theme: "light",
          bg_color: CREAM,
          eyebrow: "Infos pratiques",
          title: "Venir à l'institut",
          content:
            "<p>L'institut se trouve à <strong>Palézieux</strong>, dans le canton de Vaud. C'est un espace à domicile : l'adresse exacte et le plan d'accès vous sont transmis à la confirmation de votre rendez-vous.</p>" +
            "<h2>Prendre rendez-vous</h2>" +
            "<p>Les soins se font <strong>uniquement sur rendez-vous</strong>. Nous fixons ensemble le créneau qui vous arrange, en semaine comme le samedi. Écrivez-moi via le <a href=\"/contact\">formulaire de contact</a> et je vous réponds rapidement.</p>" +
            "<h2>Bon à savoir</h2>" +
            "<ul>" +
            "<li>Comptez 15 minutes de plus que la durée du soin pour l'accueil et le temps d'échange.</li>" +
            "<li>Les produits utilisés en cabine sont naturels et sélectionnés un par un.</li>" +
            "<li>Un doute sur le soin à choisir ? Dites-moi simplement où vous en êtes, je vous oriente.</li>" +
            "</ul>",
          image_url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1200",
          image_alt: "Espace de soin chaleureux et lumineux à Palézieux",
          image_position: "left",
          ratio: "half"
        }
      }
    ]
  },

  // ══ À propos ═══════════════════════════════════════════════════════════════
  {
    title: "À propos",
    slug: "a-propos",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          bg_color: CREAM,
          eyebrow: "Qui suis-je",
          title: "Bienvenue chez Emmanuelle",
          description: "Esthéticienne à Palézieux, je vous accueille dans mon institut à domicile pour des soins doux, naturels et pensés pour vous.",
          cta_text: "Prendre rendez-vous",
          cta_href: "/contact",
          button_style: "green"
        }
      },
      {
        type: "intro_1",
        data: {
          theme: "light",
          bg_color: WHITE,
          eyebrow: "Mon parcours",
          quote: "Prendre soin, c'est d'abord prendre le temps",
          // ⚠️ Texte de départ à personnaliser avec le vrai parcours d'Emmanuelle
          // (formation, années d'expérience, ce qui l'a menée à ouvrir son institut).
          text: "Ce texte est un point de départ, à remplacer par votre histoire depuis l'admin : votre formation, ce qui vous a menée à l'esthétique, et pourquoi vous avez choisi de recevoir chez vous plutôt qu'en salon.",
          image_url: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=1200",
          image_alt: "Emmanuelle, esthéticienne à Palézieux",
          image_position: "left"
        }
      },
      {
        type: "features_2",
        data: {
          theme: "light",
          bg_color: LINEN,
          eyebrow: "Ma façon de travailler",
          title: "Trois choses qui ne changent jamais",
          cards: [
            { icon: "🌿", title: "Des produits naturels", description: "Les soins utilisés en cabine sont choisis un par un, pour leur composition et leur douceur sur la peau." },
            { icon: "⏳", title: "Du temps, vraiment", description: "Chaque rendez-vous prévoit un moment d'échange avant le soin. On regarde ensemble ce dont votre peau a besoin ce jour-là." },
            { icon: "🤍", title: "Aucun jugement", description: "Peau sensible, réactive, négligée depuis des mois : rien de tout ça ne se commente. On part d'où vous en êtes." }
          ]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "dark",
          bg_color: SAGE_DEEP,
          title: "Envie de faire connaissance ?",
          description: "Le plus simple reste de venir. Écrivez-moi et nous trouvons un créneau ensemble.",
          cta_text: "Prendre rendez-vous",
          cta_href: "/contact",
          button_style: "white"
        }
      }
    ]
  },

  // ══ Soins ══════════════════════════════════════════════════════════════════
  // ⚠️ Prestations, durées et tarifs à compléter avec les vraies informations
  // avant la mise en ligne — les cartes ci-dessous ne portent volontairement
  // aucun prix inventé.
  {
    title: "Soins",
    slug: "soins",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          bg_color: CREAM,
          eyebrow: "Les soins",
          title: "Des soins doux, adaptés à votre peau",
          description: "Soins du visage, Head Spa, massages relaxants et beauté du regard, dans un cocon à domicile à Palézieux.",
          cta_text: "Réserver un soin",
          cta_href: "/contact",
          button_style: "green"
        }
      },
      {
        type: "features_2",
        data: {
          theme: "light",
          bg_color: WHITE,
          eyebrow: "Prestations",
          title: "Ce que je propose",
          description: "Durées et tarifs à confirmer lors de la prise de rendez-vous.",
          cards: [
            { icon: "✨", title: "Soin du visage", description: "Nettoyage, gommage, masque et modelage, avec des produits choisis pour votre type de peau. Le protocole est ajusté à chaque visite." },
            { icon: "💆", title: "Head Spa", description: "Un soin du cuir chevelu qui détend autant qu'il fait du bien aux cheveux. Massage lent, chaleur douce, et on ne pense plus à rien." },
            { icon: "🤲", title: "Massage relaxant", description: "Un massage du corps pensé pour relâcher les tensions, pas pour travailler en profondeur. L'objectif est de souffler." },
            { icon: "👁️", title: "Beauté du regard", description: "Mise en forme des sourcils, teinture, rehaussement de cils : des retouches discrètes qui changent tout." },
            { icon: "🌿", title: "Gua Sha en cabine", description: "Le modelage au Gua Sha intégré au soin du visage : drainage, éclat et un vrai moment de détente." },
            { icon: "🎁", title: "Bon cadeau", description: "Tous les soins peuvent s'offrir sous forme de bon cadeau, au montant ou à la prestation." }
          ]
        }
      },
      {
        type: "faq_1",
        data: {
          theme: "light",
          bg_color: LINEN,
          eyebrow: "Questions fréquentes",
          title: "Avant votre premier rendez-vous",
          cards: [
            {
              question: "Comment se passe une première visite ?",
              answer: "On commence par échanger quelques minutes sur votre peau, vos habitudes et ce qui vous amène. Le soin est ensuite adapté à ce que nous avons vu ensemble. Comptez environ 15 minutes de plus que la durée annoncée du soin."
            },
            {
              question: "Où se trouve exactement l'institut ?",
              answer: "L'institut est à domicile, à Palézieux, dans le canton de Vaud. L'adresse exacte et le plan d'accès vous sont transmis à la confirmation de votre rendez-vous."
            },
            {
              question: "J'ai la peau très sensible ou réactive, est-ce un problème ?",
              answer: "Non, au contraire : dites-le-moi à la prise de rendez-vous. Les produits et l'intensité du soin sont ajustés en conséquence, et on privilégie des textures douces."
            },
            {
              question: "Comment prendre rendez-vous ?",
              answer: "Uniquement sur rendez-vous, via le formulaire de contact du site. Je vous réponds rapidement et nous fixons ensemble le créneau qui vous arrange, en semaine comme le samedi."
            }
          ]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "dark",
          bg_color: SAGE_DEEP,
          title: "Réserver votre soin",
          description: "Dites-moi simplement ce qui vous ferait du bien, je vous oriente vers le soin le plus adapté.",
          cta_text: "Prendre rendez-vous",
          cta_href: "/contact",
          button_style: "white"
        }
      }
    ]
  },

  // ══ Bon cadeau ═════════════════════════════════════════════════════════════
  {
    title: "Bon cadeau",
    slug: "bon-cadeau",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          bg_color: CREAM,
          eyebrow: "Bon cadeau",
          title: "Offrez une parenthèse",
          description: "Un soin, un Head Spa ou simplement un montant libre : le bon cadeau s'adapte à ce que vous voulez offrir.",
          cta_text: "Commander un bon cadeau",
          cta_href: "/contact",
          button_style: "green"
        }
      },
      {
        type: "timeline_1",
        data: {
          theme: "light",
          bg_color: WHITE,
          eyebrow: "Comment ça marche",
          title: "En trois étapes",
          cards: [
            { title: "Vous choisissez", description: "Un soin précis ou un montant libre, selon ce qui fera le plus plaisir." },
            { title: "Vous commandez", description: "Écrivez-moi via le formulaire de contact en précisant le soin ou le montant." },
            { title: "Vous offrez", description: "Vous recevez le bon prêt à offrir, et la personne prend rendez-vous quand elle le souhaite." }
          ]
        }
      },
      {
        type: "text_1",
        data: {
          theme: "light",
          bg_color: LINEN,
          eyebrow: "Bon à savoir",
          title: "Validité et utilisation",
          // ⚠️ Durée de validité à confirmer avant la mise en ligne.
          content: "Le bon cadeau est nominatif et s'utilise en une seule fois. La durée de validité est indiquée sur le bon. Il n'est ni échangeable, ni remboursable en espèces. Une question ? Écrivez-moi, on trouvera une solution."
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "dark",
          bg_color: SAGE_DEEP,
          title: "Faire plaisir à quelqu'un",
          description: "Dites-moi le soin ou le montant, je m'occupe du reste.",
          cta_text: "Commander un bon cadeau",
          cta_href: "/contact",
          button_style: "white"
        }
      }
    ]
  },

  // ══ Mentions légales ═══════════════════════════════════════════════════════
  // ⚠️ À compléter avec la raison sociale, l'adresse et l'hébergeur réels.
  {
    title: "Mentions légales",
    slug: "mentions-legales",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          bg_color: CREAM,
          title: "Mentions légales",
          description: "Informations légales relatives au site et à son hébergement."
        }
      },
      {
        type: "text_1",
        data: {
          theme: "light",
          bg_color: WHITE,
          content:
            "Éditrice du site : Emmanuelle Esthétique, institut de beauté à domicile à Palézieux (Vaud, Suisse). " +
            "Hébergement : Netlify. " +
            "Propriété intellectuelle : les textes, visuels et logos de ce site sont protégés par le droit d'auteur. " +
            "Données personnelles : les informations transmises via le formulaire de contact servent uniquement à traiter votre demande de rendez-vous. Elles ne sont ni vendues, ni partagées. " +
            "Vous pouvez demander leur suppression à tout moment en écrivant à l'adresse e-mail de contact."
        }
      }
    ]
  },
];

export async function seedDefaultPages(): Promise<void> {
  for (const page of DEFAULT_PAGES) {
    // Check if page already exists
    const { data: existing } = await supabase
      .from('dynamic_pages')
      .select('id')
      .eq('slug', page.slug)
      .maybeSingle();

    if (existing) {
      // Update existing page
      const { error } = await supabase
        .from('dynamic_pages')
        .update({
          title: page.title,
          sections: page.sections,
          published: page.published,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (error) {
        console.error(`Error updating seeded page ${page.slug}:`, error.message);
        throw error;
      }
    } else {
      // Insert new page
      const { error } = await supabase
        .from('dynamic_pages')
        .insert({
          title: page.title,
          slug: page.slug,
          sections: page.sections,
          published: page.published
        });
      
      if (error) {
        console.error(`Error inserting seeded page ${page.slug}:`, error.message);
        throw error;
      }
    }
  }
}

export async function seedPageBySlug(slug: string): Promise<any> {
  const page = DEFAULT_PAGES.find(p => p.slug === slug);
  if (!page) {
    throw new Error(`Page par défaut avec le slug "${slug}" non trouvée.`);
  }

  // Check if page already exists
  const { data: existing } = await supabase
    .from('dynamic_pages')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Insert new page
  const { data, error } = await supabase
    .from('dynamic_pages')
    .insert({
      title: page.title,
      slug: page.slug,
      sections: page.sections,
      published: page.published
    })
    .select()
    .single();

  if (error) {
    console.error(`Error inserting seeded page ${slug}:`, error.message);
    throw error;
  }
  return data;
}
