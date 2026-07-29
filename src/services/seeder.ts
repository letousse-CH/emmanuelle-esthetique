import { supabase } from './supabase';
import type { PageSection } from '../components/pagebuilder/wireframes.config';

interface DefaultPageSeed {
  title: string;
  slug: string;
  sections: PageSection[];
  published: boolean;
}

const DEFAULT_PAGES: DefaultPageSeed[] = [
  {
    title: "Accueil",
    slug: "home",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "dark",
          bg_color: "#0A0A0A",
          eyebrow: "Coaching Relation Toxique",
          title: "Comprendre l'Emprise, Briser les Chaînes",
          title_italic: "et Se Reconstruire",
          description: "Tu as longtemps cru que le problème venait de toi. Aujourd'hui, la confusion laisse place à une certitude : tu es ou tu as été sous emprise. Ne reste plus seul(e) face au doute. Bénéficie d'un accompagnement pragmatique, direct et orienté résultats pour décoder les mécanismes de manipulation.",
          cta_primary_text: "RÉSERVER MA SESSION OFFERTE",
          cta_primary_href: "/contact",
          image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600",
          image_opacity: 40,
          button_style: "green"
        }
      },
      {
        type: "features_2",
        data: {
          theme: "dark",
          bg_color: "#0F0F0F",
          eyebrow: "Symptômes de l'emprise",
          title: "Reconnaître les Signaux d'Alerte",
          description: "Vivre aux côtés d'une personnalité manipulatrice toxique n'est pas neutre. C'est une érosion lente et méthodique de ton identité psychique.",
          cards: [
            { title: "La confusion (Gaslighting)", description: "Tu doutes continuellement de tes propres souvenirs et de ton jugement.", icon: "🤯" },
            { title: "La marche sur des œufs", description: "Ton quotidien est dicté par la peur de la prochaine explosion ou du silence punitif.", icon: "🍳" },
            { title: "L'épuisement biologique", description: "Ton corps envoie des signaux massifs de détresse (crises d'angoisse, insomnie).", icon: "🚨" }
          ]
        }
      },
      {
        type: "intro_1",
        data: {
          theme: "dark",
          bg_color: "#0A0A0A",
          eyebrow: "De la Clinique au Terrain",
          quote: "Pourquoi mon Approche fait Autorité",
          text: "Je ne vais pas me contenter de t'accueillir et de hocher la tête. Je connais intimement les verrous psychologiques de ton agresseur pour les avoir vécus dans ma chair, et je possède la clé tactique pour les faire sauter.",
          cta_text: "Découvrir mon parcours",
          cta_href: "/about",
          image_url: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=800"
        }
      },
      {
        type: "features_3",
        data: {
          theme: "dark",
          bg_color: "#0F0F0F",
          eyebrow: "L'Arsenal Tactique",
          title: "Accompagnements Stratégiques",
          description: "Découvrez nos formats de consultations adaptés à l'urgence de votre situation.",
          cards: [
            {
              title: "Programme Complet",
              description: "Un voyage complet de reconstruction identitaire intense sur 3 mois.",
              items: ["12 séances de 90 minutes", "Support par messagerie", "Immunisation définitive"],
              cta_text: "Découvrir le programme",
              cta_href: "/programme-complet",
              badge: "Recommandé"
            },
            {
              title: "Séance Individuelle",
              description: "Une immersion ciblée pour débloquer un point de crise précis.",
              items: ["Séance unique de 90 min", "Focus résolution de blocage", "Analyse symbolique de rêve"],
              cta_text: "Réserver la séance",
              cta_href: "/seance-individuelle"
            }
          ]
        }
      },
      {
        type: "gallery_grid",
        data: {
          theme: "dark",
          bg_color: "#0A0A0A",
          eyebrow: "Galerie & Ressources",
          title: "Livres et Analyses Gratuites",
          description: "Plongez dans des outils cliniques concrets d'émancipation psychologique.",
          columns: "3",
          cards: [
            { title: "Paroles et Silences", description: "Livre philosophique pour cesser la guerre intérieure.", image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800", link: "/paroles-et-silences" },
            { title: "Si les arbres pouvaient parler", description: "Récit d'une reconstruction post-traumatique.", image: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800", link: "/si-les-arbres-pouvaient-parler" },
            { title: "Podcast & Vidéos", description: "Décryptages cliniques hebdomadaires de la manipulation.", image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=800", link: "/blog" }
          ]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "dark",
          bg_color: "#0F0F0F",
          title: "Ne laisse plus un profil manipulateur écrire ta vie",
          description: "Faisons le point de manière strictement confidentielle et sécurisée.",
          cta_text: "RÉSERVER MON ENTRETIEN OFFERT",
          cta_href: "/contact"
        }
      }
    ]
  },
  {
    title: "À Propos",
    slug: "about",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          eyebrow: "Qui suis-je",
          title: "Je vous aide à vous libérer",
          description: "Matthieu Le Tousse — Ancien thérapeute en cabinet reconverti dans l'accompagnement de la dépendance et de l'emprise relationnelle.",
          cta_text: "Me Contacter",
          cta_href: "/contact"
        }
      },
      {
        type: "intro_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          eyebrow: "Mon Histoire",
          quote: "De la blessure à la transmission",
          text: "Après 6 ans d'expérience intensive en cabinet et un parcours personnel confronté directement aux structures familiales toxiques et psychotiques, j'ai choisi de transmettre les clés opérationnelles de défense émotionnelle.",
          image_url: "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?q=80&w=800"
        }
      },
      {
        type: "features_2",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          eyebrow: "Compétences clés",
          title: "Un cadre professionnel solide",
          cards: [
            { title: "Psychologie Clinique", description: "6 ans de consultation thérapeutique individuelle en cabinet privé." },
            { title: "Rêve Éveillé Libre", description: "Diplômé de l'école de Paris (curation des traumatismes profonds)." },
            { title: "Crisis Management", description: "Méthodes comportementales face à la perversion et au harcèlement." }
          ]
        }
      },
      {
        type: "testimonial_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          quote: "Les ressources pour guérir et rebâtir votre autonomie sont déjà présentes. Mon rôle est de vous équiper de la stratégie pour les libérer.",
          author: "Matthieu Le Tousse",
          role: "Semeur d'Eveil"
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          title: "Brisez l'isolement dès aujourd'hui",
          description: "Bénéficiez d'une écoute qualifiée et sans aucun jugement.",
          cta_text: "Réserver un premier contact",
          cta_href: "/contact",
          button_style: "green"
        }
      }
    ]
  },
  {
    title: "Accompagnement",
    slug: "accompagnement",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "dark",
          bg_color: "#1c1c1c",
          eyebrow: "Posture masculine & autonomie",
          title: "L'Accompagnement Posture",
          title_italic: "& Leadership",
          description: "Un parcours sur mesure conçu pour cesser de douter de votre réalité, restaurer des frontières relationnelles impénétrables et reprendre le contrôle de votre destin.",
          cta_primary_text: "ÉVALUER MA SITUATION (OFFERT)",
          cta_primary_href: "/contact",
          image_url: "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?q=80&w=1600",
          button_style: "green"
        }
      },
      {
        type: "features_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          eyebrow: "Objectifs tactiques",
          title: "Développer un Mindset Impénétrable",
          description: "L'emprise s'effondre lorsque la victime cesse de réagir émotionnellement aux provocations de l'agresseur.",
          items: [
            "Comprendre cliniquement la structure psychique perverse ou manipulatrice.",
            "Maîtriser les scripts de communication d'urgence (méthode de la roche grise).",
            "Éliminer la culpabilité induite et le syndrome de Stockholm.",
            "Reprogrammer ses croyances pour interdire définitivement l'accès aux prédateurs."
          ]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "dark",
          bg_color: "#0A0A0A",
          title: "Reprenez le leadership de votre vie relationnelle",
          description: "30 minutes d'échange pour dessiner votre plan de sevrage émotionnel.",
          cta_text: "Réserver mon appel stratégique",
          cta_href: "/contact"
        }
      }
    ]
  },
  {
    title: "Contact",
    slug: "contact",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          eyebrow: "Discrétion assurée",
          title: "Entrer en contact",
          description: "Que ce soit pour un message d'information ou pour planifier votre entretien offert de 30 minutes, je lis et réponds personnellement sous 24h ouvrées."
        }
      },
      {
        type: "text_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          title: "Formulaire de premier échange",
          content: "Veuillez remplir le formulaire disponible sur cette page. Vos données restent strictement confidentielles et ne seront jamais partagées."
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          title: "Accéder directement à l'agenda",
          description: "Pour un rendez-vous rapide, choisissez votre créneau horaire en ligne.",
          cta_text: "Consulter l'agenda en ligne",
          cta_href: "https://calendly.com",
          button_style: "green"
        }
      }
    ]
  },
  {
    title: "Mentions Légales",
    slug: "mentions-legales",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          title: "Mentions Légales",
          description: "Mentions d'information obligatoires concernant le site et l'hébergement."
        }
      },
      {
        type: "text_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          content: "Editeur du site : Matthieu Le Tousse. Hébergement : Netlify. Propriété intellectuelle : Tous les textes, logos et images de ce site sont protégés par le droit d'auteur. Données personnelles : Vos informations de contact ne servent qu'à traiter vos demandes et ne sont jamais vendues ni partagées."
        }
      }
    ]
  },
  {
    title: "Paroles & Silences",
    slug: "paroles-et-silences",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "dark",
          bg_color: "#1c1c1c",
          eyebrow: "Livre broché & ebook",
          title: "Paroles & Silences",
          description: "Un recueil de réflexions intimes et brutes pour cesser la lutte psychologique et accueillir le silence souverain au coeur de nos vies.",
          cta_primary_text: "Acheter sur Amazon",
          cta_primary_href: "https://amzn.eu",
          image_url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1600"
        }
      },
      {
        type: "text_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          eyebrow: "Présentation",
          title: "Faire le vide pour retrouver le plein",
          content: "Ce recueil réunit des textes écrits en fin de journée thérapeutique. Ils traitent de l'amour propre, du deuil, de la solitude nécessaire et des clés de réconciliation avec ses propres ombres."
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          title: "Disponible sur toutes les plateformes",
          description: "Commandez le livre en format broché ou numérique.",
          cta_text: "Commander mon exemplaire",
          cta_href: "https://amzn.eu",
          button_style: "green"
        }
      }
    ]
  },
  {
    title: "Si les arbres pouvaient parler",
    slug: "si-les-arbres-pouvaient-parler",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "dark",
          bg_color: "#0A0A0A",
          eyebrow: "Témoignage autobiographique",
          title: "Si les arbres pouvaient parler",
          description: "Le récit d'une enfance adoptée en Roumanie, d'une amnésie traumatique lourde et de la renaissance progressive grâce au Rêve Éveillé Libre.",
          cta_primary_text: "Commander le livre",
          cta_primary_href: "https://amzn.eu",
          image_url: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1600"
        }
      },
      {
        type: "text_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          eyebrow: "À propos du récit",
          title: "Un guide d'espoir thérapeutique",
          content: "Ce témoignage démontre comment le cerveau parvient à enfouir des traumas et comment le travail symbolique sur les rêves permet d'en libérer la charge émotionnelle toxique sans revivre l'effroi."
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          title: "Commandez sur Amazon",
          description: "Découvrez cette histoire inspirante de survie et d'éveil.",
          cta_text: "Acheter le livre",
          cta_href: "https://amzn.eu",
          button_style: "green"
        }
      }
    ]
  },
  {
    title: "Séance Individuelle",
    slug: "seance-individuelle",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          eyebrow: "Entretien ciblé",
          title: "La Séance Individuelle",
          description: "Une consultation unique de 90 minutes pour analyser une situation critique de communication, poser des mots sur un blocage ou analyser vos rêves.",
          cta_primary_text: "Prendre rendez-vous",
          cta_primary_href: "/contact",
          image_url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1600",
          button_style: "green"
        }
      },
      {
        type: "features_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          eyebrow: "Déroulement de la séance",
          title: "Un espace d'écoute et d'action",
          description: "Chaque séance est individualisée pour répondre à votre état émotionnel immédiat.",
          items: [
            "90 minutes de décodage stratégique.",
            "Analyse symbolique jungienne (rêve ou symptôme).",
            "Mise en place de scripts de communication roche grise.",
            "Exercices respiratoires de régulation du système nerveux."
          ]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          title: "Investissement : 140 CHF / séance",
          description: "Consultations à distance ou en cabinet à Palézieux.",
          cta_text: "Réserver un créneau",
          cta_href: "/contact",
          button_style: "green"
        }
      }
    ]
  },
  {
    title: "Programme Complet",
    slug: "programme-complet",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "dark",
          bg_color: "#1c1c1c",
          eyebrow: "Parcours 3 mois",
          title: "L'Arsenal Tactique",
          description: "Le système pas-à-pas pour inverser le rapport de force relationnel, traverser le manque émotionnel et s'immuniser définitivement contre la manipulation.",
          cta_primary_text: "Demander mon entretien préalable",
          cta_primary_href: "/contact",
          image_url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1600",
          button_style: "green"
        }
      },
      {
        type: "features_2",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          eyebrow: "Piliers d'éveil",
          title: "Le chemin vers la souveraineté",
          cards: [
            { title: "1. Stabilité nerveuse", description: "Sortir du mode survie et de l'hypervigilance en calmant la chimie du stress." },
            { title: "2. Sevrage du Trauma-Bond", description: "Casser l'addiction biologique aux cycles alternants du manipulateur." },
            { title: "3. Pose de limites fermes", description: "Verrouiller son territoire et automatiser ses réflexes de défense comportementale." }
          ]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "dark",
          bg_color: "#0A0A0A",
          title: "Accompagnement sélectif sur entretien",
          description: "Vérifions ensemble si le programme Arsenal Tactique correspond à vos objectifs.",
          cta_text: "Postuler à l'accompagnement",
          cta_href: "/contact"
        }
      }
    ]
  },
  {
    title: "Rêve Éveillé Libre",
    slug: "reve-eveille-libre",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          eyebrow: "Hypnose douce par le symbole",
          title: "Le Rêve Éveillé Libre",
          description: "Une approche thérapeutique par l'imaginaire pour décoder et dissoudre les empreintes traumatiques inconscientes.",
          cta_primary_text: "Prendre rendez-vous",
          cta_primary_href: "/contact",
          image_url: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1600",
          button_style: "green"
        }
      },
      {
        type: "features_1",
        data: {
          theme: "light",
          bg_color: "#ffffff",
          eyebrow: "Cure symbolique",
          title: "Comment se déroule la séance ?",
          description: "Allongé dans un état de détente, vous observez et décrivez les images qui apparaissent à vos yeux fermés.",
          items: [
            "Libération des charges émotionnelles du passé sans avoir à revivre le trauma.",
            "Dialogue direct avec les symboles et archétypes de l'inconscient.",
            "Accompagnement agréé ADREL (Association Rêve Éveillé Libre).",
            "Soutien idéal pour les phases de deuil, de séparation ou de dépression."
          ]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "light",
          bg_color: "#fcfbf7",
          title: "Prenez rendez-vous en cabinet ou visio",
          description: "Faites l'expérience du nettoyage inconscient.",
          cta_text: "Réserver une séance d'essai",
          cta_href: "/contact",
          button_style: "green"
        }
      }
    ]
  }
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
