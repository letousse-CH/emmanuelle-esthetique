import { Inter, Cormorant_Garamond } from 'next/font/google';
import '../index.css';
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
          alt: SITE_CONFIG.name,
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
// Alimentées par Paramètres > Éditorial & Marque : une liste codée en dur
// décrirait le métier du client précédent.
function knowsAboutFrom(raw: string): string[] {
  return raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
}

function buildStructuredData(
  sameAs: string[],
  business: BusinessInfo,
  editorial: { activity: string; jobTitle: string },
) {
  const activity = editorial.activity;
  const knowsAbout = knowsAboutFrom(editorial.activity);
  // Zone desservie déduite de l'adresse : ville puis canton, rien d'inventé.
  const areaServed = [
    business.addressCity && { '@type': 'City', name: business.addressCity },
    business.addressRegion && {
      '@type': 'AdministrativeArea',
      name: business.addressRegion,
    },
  ].filter(Boolean);

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
        about: { '@id': `${SITE_URL}/#owner` },
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/#owner`,
        name: business.owner,
        ...(editorial.jobTitle ? { jobTitle: editorial.jobTitle } : {}),
        ...(activity ? { description: activity } : {}),
        url: SITE_URL,
        image: PHOTO_URL,
        ...(knowsAbout.length ? { knowsAbout } : {}),
        address: postalAddress,
        ...(sameAs.length ? { sameAs } : {}),
        worksFor: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'LocalBusiness',
        '@id': `${SITE_URL}/#organization`,
        name: business.name,
        ...(activity ? { description: activity } : {}),
        url: SITE_URL,
        image: PHOTO_URL,
        founder: { '@id': `${SITE_URL}/#owner` },
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
        // Dérivée de l'adresse saisie dans les réglages : une liste de
        // communes en dur suivrait le template d'installation en installation.
        ...(areaServed.length ? { areaServed } : {}),
        priceRange: business.priceRange,
        ...(knowsAbout.length ? { knowsAbout } : {}),
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
  const editorialSettings = await getSettingsServer([
    'site_activity_context',
    'business_job_title',
  ]);
  const structuredData = buildStructuredData(sameAs, business, {
    activity: editorialSettings.site_activity_context || '',
    jobTitle: editorialSettings.business_job_title || '',
  });

  return (
    <html lang="fr" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="bg-paper text-stone-deep font-sans antialiased min-h-screen selection:bg-sage/20 flex flex-col overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ScrollAnimations />
        <UniversalPageEditor />
        {children}
      </body>
    </html>
  );
}
