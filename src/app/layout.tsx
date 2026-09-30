import { Inter, Cormorant_Garamond } from 'next/font/google';
import '../index.css';
import UniversalPageEditorGate from '../components/pagebuilder/UniversalPageEditorGate';
import ScrollAnimations from '../components/ScrollAnimations';
import MotionLayer from '../components/MotionLayer';
import { getSettingsServer } from '../services/settingsServer';
import { getBusinessInfoServer, BusinessInfo, SITE_CONFIG } from '../config/site';
import { flatCarte } from '../constants/carteSoins';

// ISR : le shell global (favicon, liens sociaux, Schema.org) est mis en cache
// et revalidé toutes les heures au lieu d'un SSR par requête. Les composants du
// layout (UniversalPageEditor, etc.) sont "use client" et gèrent l'auth Supabase
// côté navigateur — aucun rendu serveur par requête n'est nécessaire.
export const revalidate = 3600;

// Polices de repli du gabarit, quand aucune charte n'est réglée. La charte du site les
// remplace : pas de préchargement, elles ne se téléchargent que si un texte les utilise.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
  preload: false,
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
    // Balise de vérification Google Search Console. Vide tant que
    // GOOGLE_SITE_VERIFICATION n'est pas renseigné : la balise n'apparaît
    // simplement pas, sans casser le <head>.
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
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
// "menu de prestations" que les moteurs IA peuvent citer par soin. Il découle
// de la carte des soins (constants/carteSoins.ts), source unique des prix :
// chaque soin pointe vers la page pilier de sa catégorie.
function buildOfferCatalog(siteUrl: string) {
  const offers = flatCarte().flatMap((item) => {
    const url = `${siteUrl}${item.category.path}`;
    const prices = item.variants?.length
      ? item.variants.map((v) => ({ name: `${item.name} (${v.duration})`, price: v.price }))
      : [{ name: item.name, price: item.price }];
    return prices.map((p) => ({ name: p.name, price: String(p.price), url, category: item.category.label, description: item.description }));
  });

  return {
    '@type': 'OfferCatalog',
    name: 'Carte des soins · Emmanuelle Esthétique',
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
        ...(o.description ? { description: o.description } : {}),
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
    // suppressHydrationWarning : le script ci-dessous ajoute `pb-motion` à <html>
    // avant l'hydratation.
    <html lang="fr" className={`${inter.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Active la couche de mouvement (blocks.css, section Mouvement) avant le
          premier rendu, pour que les blocs naissent cachés au lieu d'apparaître
          puis de disparaître. Jamais dans l'admin ni avec « réduire les
          animations ». Si MotionLayer n'a pas pris la main au bout de 4 s
          (script bloqué, erreur), la classe est retirée : le contenu s'affiche.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;if(location.pathname.indexOf('/admin')===0||matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('pb-motion');setTimeout(function(){if(!window.__pbMotion)d.classList.remove('pb-motion')},4000)}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-paper text-stone-deep font-sans antialiased min-h-screen selection:bg-sage/20 flex flex-col overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ScrollAnimations />
        <MotionLayer />
        <UniversalPageEditorGate />
        {children}
      </body>
    </html>
  );
}
