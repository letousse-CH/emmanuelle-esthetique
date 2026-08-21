import { supabase } from './supabase';
import type { PageSection } from '../components/pagebuilder/wireframes.config';

interface DefaultPageSeed {
  title: string;
  slug: string;
  sections: PageSection[];
  published: boolean;
}

/*
  Pages de démarrage du template.

  Volontairement squelettiques : trois pages, des sections vides, aucune
  couleur imposée. Le rôle de ce seeder est de donner une ossature à remplir,
  pas de livrer le site d'un autre client. Les textes de démonstration d'un
  métier précis se retrouveraient sinon en production chez le suivant.

  Les fonds sont laissés vides : les sections héritent alors de la palette
  définie dans Paramètres > Design & Style.
*/
const DEFAULT_PAGES: DefaultPageSeed[] = [
  {
    title: "Accueil",
    slug: "home",
    published: true,
    sections: [
      {
        type: "hero_1",
        data: {
          theme: "light",
          eyebrow: "",
          title: "Votre titre principal",
          title_italic: "",
          description: "Décrivez en une phrase ce que vous faites et pour qui.",
          cta_primary_text: "Nous contacter",
          cta_primary_href: "/contact",
          cta_secondary_text: "",
          cta_secondary_href: "",
          image_url: "",
          image_alt: "",
          image_opacity: 100
        }
      },
      {
        type: "features_1",
        data: {
          theme: "light",
          title: "Ce que nous proposons",
          description: "",
          items: ["Première prestation", "Deuxième prestation", "Troisième prestation"]
        }
      },
      {
        type: "cta_1",
        data: {
          theme: "light",
          title: "Parlons de votre projet",
          description: "",
          cta_primary_text: "Nous contacter",
          cta_primary_href: "/contact"
        }
      }
    ]
  },
  {
    title: "À propos",
    slug: "a-propos",
    published: true,
    sections: [
      {
        type: "hero_2",
        data: {
          theme: "light",
          eyebrow: "",
          title: "À propos",
          description: "Présentez votre parcours, votre méthode, ce qui vous distingue.",
          image_url: "",
          image_alt: ""
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
          eyebrow: "",
          title: "Contact",
          description: "Indiquez ici comment vous joindre et sous quel délai vous répondez.",
          image_url: "",
          image_alt: ""
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
