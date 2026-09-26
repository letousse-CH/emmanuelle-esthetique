import { Inter, Cormorant_Garamond } from 'next/font/google';
import '../index.css';
import UniversalPageEditorGate from '../components/pagebuilder/UniversalPageEditorGate';
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
  adjustFontFallback: false,
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
  adjustFontFallback: false,
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

interface LocalExtras {
  areaServedList: string[];        // "Palézieux-Gare, Oron, …"
  openingHours: Array<{ days: string[]; opens: string; closes: string }>;
  geoLat: string;
  geoLng: string;
  schemaType: string;              // ex: 'BeautySalon' — sous-type LocalBusiness
}

// Catalogue d'offres — signal riche pour Google Rich Results et un vrai
// "menu de prestations" que les moteurs IA peuvent citer par soin. La liste
// vit ici parce qu'elle est stable ; toute nouvelle URL/prix se met à jour
// au même endroit que le seeder Emmanuelle.
function buildOfferCatalog(siteUrl: string) {
  const offers: Array<{
    name: string;
    url: string;
    price: string;              // valeur brute (min)
    category: string;
  }> = [
    // Soins du visage
    {
      name: 'Soin visage signature Phytomer',
      url: `${siteUrl}/soin-visage-signature-palezieux`,
      price: '130',
      category: 'Soins du visage',
    },
    {
      name: 'Soin visage anti-âge',
      url: `${siteUrl}/soin-anti-age-palezieux`,
      price: '170',
      category: 'Soins du visage',
    },
    {
      name: 'Soin visage peau sensible',
      url: `${siteUrl}/soin-visage-peau-sensible-palezieux`,
      price: '150',
      category: 'Soins du visage',
    },
    // Soins du corps
    {
      name: 'Massage relaxant aux huiles chaudes',
      url: `${siteUrl}/massage-relaxant-huiles-chaudes-palezieux`,
      price: '120',
      category: 'Soins du corps',
    },
    {
      name: 'Head Spa · massage du cuir chevelu',
      url: `${siteUrl}/head-spa-palezieux`,
      price: '70',
      category: 'Soins du corps',
    },
    // Beauté du regard
    {
      name: 'Mise en forme des sourcils',
      url: `${siteUrl}/sourcils-mise-en-forme-palezieux`,
      price: '35',
      category: 'Beauté du regard',
    },
    {
      name: 'Teinture cils & sourcils',
      url: `${siteUrl}/teinture-cils-sourcils-palezieux`,
      price: '30',
      category: 'Beauté du regard',
    },
    {
      name: 'Rehaussement de cils',
      url: `${siteUrl}/rehaussement-cils-palezieux`,
      price: '85',
      category: 'Beauté du regard',
    },
    {
      name: 'Cours de maquillage sur-mesure',
      url: `${siteUrl}/cours-de-maquillage-palezieux`,
      price: '110',
      category: 'Beauté du regard',
    },
    // Épilation
    {
      name: 'Épilation à la cire au sucre',
      url: `${siteUrl}/epilation-sucre-palezieux`,
      price: '15',
      category: 'Épilation',
    },
    // Ateliers
    {
      name: 'Atelier Gua Sha visage',
      url: `${siteUrl}/atelier-gua-sha-palezieux`,
      price: '90',
      category: "Ateliers d'auto-soin",
    },
    {
      name: 'Atelier Glowing Face',
      url: `${siteUrl}/atelier-glowing-face-palezieux`,
      price: '110',
      category: "Ateliers d'auto-soin",
    },
  ];

  return {
    '@type': 'OfferCatalog',
    name: 'Prestations · Emmanuelle Esthétique',
    itemListElement: offers.map((o) => ({
      '@type': 'Offer',
      name: o.name,
      url: o.url,
      priceCurrency: 'CHF',
      price: o.price,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        priceCurrency: 'CHF',
        price: o.price,
      },
      category: o.category,
      itemOffered: {
        '@type': 'Service',
        name: o.name,
        url: o.url,
        provider: { '@id': `${siteUrl}/#organization` },
        areaServed: 'Palézieux-Gare',
      },
      availability: 'https://schema.org/InStock',
      businessFunction: 'https://schema.org/ProvideService',
      seller: { '@id': `${siteUrl}/#organization` },
    })),
  };
}

function buildStructuredData(
  sameAs: string[],
  business: BusinessInfo,
  editorial: { activity: string; jobTitle: string },
  extras: LocalExtras,
) {
  const activity = editorial.activity;
  const knowsAbout = knowsAboutFrom(editorial.activity);
  // Zone desservie : la liste explicite du réglage `business_area_served`
  // prend le pas ; sinon repli sur ville + canton déduits de l'adresse.
  const areaServed = extras.areaServedList.length
    ? extras.areaServedList.map((name) => ({ '@type': 'City', name }))
    : [
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

  const openingHoursSpecification = extras.openingHours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: h.days,
    opens: h.opens,
    closes: h.closes,
  }));

  const geo =
    extras.geoLat && extras.geoLng
      ? {
          '@type': 'GeoCoordinates',
          latitude: extras.geoLat,
          longitude: extras.geoLng,
        }
      : undefined;

  const localType = extras.schemaType || 'LocalBusiness';

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
        // BeautySalon quand renseigné : Google reconnaît explicitement le
        // sous-type pour les rich results locaux "beauty & wellness".
        '@type': localType,
        '@id': `${SITE_URL}/#organization`,
        name: business.name,
        ...(activity ? { description: activity } : {}),
        url: SITE_URL,
        image: PHOTO_URL,
        founder: { '@id': `${SITE_URL}/#owner` },
        address: postalAddress,
        ...(geo ? { geo } : {}),
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
        ...(areaServed.length ? { areaServed } : {}),
        ...(openingHoursSpecification.length
          ? { openingHoursSpecification }
          : {}),
        priceRange: business.priceRange,
        // hasOfferCatalog : signal riche pour Google et menu de prestations
        // exploitable directement par ChatGPT/Perplexity (URL par soin +
        // prix). Ne dépend pas de settings pour rester source unique de vérité.
        hasOfferCatalog: buildOfferCatalog(SITE_URL),
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
    'business_area_served',
    'business_opening_hours',
    'business_geo_lat',
    'business_geo_lng',
    'business_schema_type',
  ]);
  const areaServedList = (editorialSettings.business_area_served || '')
    .split(/[,;]+/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  let openingHours: Array<{ days: string[]; opens: string; closes: string }> = [];
  try {
    if (editorialSettings.business_opening_hours) {
      openingHours = JSON.parse(editorialSettings.business_opening_hours);
    }
  } catch {
    openingHours = [];
  }
  const structuredData = buildStructuredData(
    sameAs,
    business,
    {
      activity: editorialSettings.site_activity_context || '',
      jobTitle: editorialSettings.business_job_title || '',
    },
    {
      areaServedList,
      openingHours,
      geoLat: editorialSettings.business_geo_lat || '',
      geoLng: editorialSettings.business_geo_lng || '',
      schemaType: editorialSettings.business_schema_type || '',
    },
  );

  return (
    <html lang="fr" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="bg-paper text-stone-deep font-sans antialiased min-h-screen selection:bg-sage/20 flex flex-col overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ScrollAnimations />
        <UniversalPageEditorGate />
        {children}
      </body>
    </html>
  );
}
