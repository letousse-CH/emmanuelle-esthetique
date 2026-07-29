import { Inter, Cormorant_Garamond } from 'next/font/google';
import '../index.css';
import GlobalStyles from '../components/GlobalStyles';
import UniversalPageEditor from '../components/pagebuilder/UniversalPageEditor';
import ScrollAnimations from '../components/ScrollAnimations';
import { getSettingsServer } from '../services/settingsServer';
import { getBusinessInfoServer, BusinessInfo, SITE_CONFIG } from '../config/site';

// ISR : le shell global (favicon, liens sociaux, Schema.org) est mis en cache
// et revalidé toutes les heures au lieu d'un SSR par requête. Les composants du
// layout (UniversalPageEditor, etc.) sont "use client" et gèrent l'auth Supabase
// côté navigateur — aucun rendu serveur par requête n'est nécessaire.
export const revalidate = 3600;

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export async function generateMetadata() {
  const settings = await getSettingsServer(['favicon_url']);
  const favicon = settings.favicon_url || undefined;
  return {
    title: SITE_CONFIG.seoDefaults.title,
    description: SITE_CONFIG.seoDefaults.description,
    metadataBase: new URL(SITE_CONFIG.url),
    icons: favicon ? {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    } : undefined,
    openGraph: {
      siteName: SITE_CONFIG.name,
      locale: "fr_CH",
      type: "website",
      images: [
        {
          url: SITE_CONFIG.seoDefaults.ogImage,
          width: 1200,
          height: 630,
          alt: "Emmanuelle Esthétique — Institut de beauté à domicile à Palézieux",
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

// Données structurées Schema.org — Identité (E-E-A-T) + Service local
// Schéma combiné Person ⇄ BeautySalon reliés par @id.
// Le `sameAs` est construit dynamiquement à partir des liens sociaux du footer
// (réglages Supabase) : si un lien change dans l'admin, la balise suit.
const SITE_URL = SITE_CONFIG.url;
const PHOTO_URL = SITE_CONFIG.seoDefaults.ogImage;

// Prestations proposées — signal de pertinence pour le SEO local.
const KNOWS_ABOUT = [
  'Soin du visage',
  'Head Spa',
  'Massage relaxant',
  'Gua Sha',
  'Auto-massage du visage',
  'Beauté du regard',
  'Cosmétique naturelle',
  'Ateliers bien-être',
];

function buildStructuredData(sameAs: string[], business: BusinessInfo) {
  // Adresse de l'entité (E-E-A-T / SEO local) — coordonnées éditables depuis
  // l'admin (Paramètres > Entreprise), pas de rue/code postal inventés si non
  // renseignés.
  const postalAddress = {
    '@type': 'PostalAddress',
    ...(business.addressStreet ? { streetAddress: business.addressStreet } : {}),
    ...(business.addressPostal ? { postalCode: business.addressPostal } : {}),
    addressLocality: business.addressCity,
    addressRegion: business.addressRegion,
    addressCountry: business.addressCountry,
  } as const;

  const phone = business.phone ? business.phone.replace(/\s+/g, '') : '';

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: business.name,
        inLanguage: 'fr-CH',
        publisher: { '@id': `${SITE_URL}/#organization` },
        about: { '@id': `${SITE_URL}/#emmanuelle` },
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/#emmanuelle`,
        name: business.owner,
        jobTitle: 'Esthéticienne',
        description:
          "Esthéticienne à Palézieux, Emmanuelle propose des soins du visage doux et naturels, des Head Spa, des massages relaxants et des ateliers bien-être dans son institut à domicile.",
        url: SITE_URL,
        image: PHOTO_URL,
        knowsAbout: KNOWS_ABOUT,
        address: postalAddress,
        ...(sameAs.length ? { sameAs } : {}),
        worksFor: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'BeautySalon',
        '@id': `${SITE_URL}/#organization`,
        name: business.name,
        alternateName: `${business.name} — Institut à domicile`,
        description:
          "Institut de beauté et bien-être à domicile à Palézieux : soins du visage, Head Spa, massages relaxants, beauté du regard et ateliers de cosmétique naturelle.",
        url: SITE_URL,
        image: PHOTO_URL,
        founder: { '@id': `${SITE_URL}/#emmanuelle` },
        address: postalAddress,
        ...(phone
          ? {
              telephone: phone,
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: phone,
                contactType: 'customer service',
                availableLanguage: ['fr'],
              },
            }
          : {}),
        // Institut à domicile à Palézieux — clientèle de proximité (Broye-Vully,
        // Lavaux-Oron, Riviera) dans le canton de Vaud.
        areaServed: [
          { '@type': 'City', name: 'Palézieux' },
          { '@type': 'AdministrativeArea', name: 'District de Lavaux-Oron', containedInPlace: { '@type': 'Country', name: 'Suisse' } },
          { '@type': 'AdministrativeArea', name: 'Canton de Vaud', containedInPlace: { '@type': 'Country', name: 'Suisse' } },
        ],
        priceRange: business.priceRange,
        knowsAbout: KNOWS_ABOUT,
        ...(sameAs.length ? { sameAs } : {}),
      },
    ],
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [social, business] = await Promise.all([
    getSettingsServer([
      'social_linkedin',
      'social_instagram',
      'social_youtube',
      'social_spotify',
    ]),
    getBusinessInfoServer(),
  ]);
  // dédoublonnage : deux réglages sociaux peuvent pointer vers la même URL.
  // Ajouter ici l'URL du profil Google Business dès qu'il est créé (signal
  // d'autorité externe pour l'entité).
  const sameAs = Array.from(
    new Set(
      [
        social.social_linkedin,
        social.social_instagram,
        social.social_youtube,
        social.social_spotify,
      ].filter(Boolean)
    )
  );
  const structuredData = buildStructuredData(sameAs, business);

  return (
    <html lang="fr" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="bg-paper text-stone-deep font-sans antialiased min-h-screen selection:bg-sage/20 flex flex-col overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <GlobalStyles />
        <ScrollAnimations />
        <UniversalPageEditor />
        {children}
      </body>
    </html>
  );
}
