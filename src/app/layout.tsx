import { Inter, Playfair_Display } from 'next/font/google';
import '../index.css';
import GlobalStyles from '../components/GlobalStyles';
import UniversalPageEditor from '../components/pagebuilder/UniversalPageEditor';
import ScrollAnimations from '../components/ScrollAnimations';
import { getSettingsServer } from '../services/settingsServer';
import { getBusinessInfoServer, BusinessInfo } from '../config/site';

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

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export async function generateMetadata() {
  const settings = await getSettingsServer(['favicon_url']);
  const favicon = settings.favicon_url || undefined;
  return {
    title: "Coach Relation Toxique & Pervers Narcissique | Matthieu Le Tousse",
    description: "Décoder les mécanismes de l'emprise, briser le brouillard mental et reprendre définitivement le contrôle. Matthieu Le Tousse — Coach Relation Toxique & PN.",
    metadataBase: new URL('https://audeladeschaines.com'),
    icons: favicon ? {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    } : undefined,
    openGraph: {
      siteName: "Au-delà des Chaînes",
      locale: "fr_CH",
      type: "website",
      images: [
        {
          url: "https://pub-06788dc2f8884cb1bba449c00813d758.r2.dev/1782229256675-Matthieu-Le-Tousse.webp",
          width: 1200,
          height: 630,
          alt: "Matthieu Le Tousse — Coach Relation Toxique & Emprise Psychologique",
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

// Données structurées Schema.org — Identité (E-E-A-T) + Service
// Schéma combiné Person ⇄ ProfessionalService reliés par @id.
// Le `sameAs` est construit dynamiquement à partir des liens sociaux du footer
// (réglages Supabase) : si un lien change dans l'admin, la balise suit.
const LOGO_URL =
  'https://pub-06788dc2f8884cb1bba449c00813d758.r2.dev/1780852325790-logo-au-dela-des-chaines--1-.png';
const PHOTO_URL =
  'https://pub-06788dc2f8884cb1bba449c00813d758.r2.dev/1782229256675-Matthieu-Le-Tousse.webp';

// Compétences thématiques — signal d'expertise (E-E-A-T) pour un sujet YMYL.
const KNOWS_ABOUT = [
  'Relations toxiques',
  'Emprise psychologique',
  'Pervers narcissique',
  'Manipulation mentale',
  "Sortie d'emprise",
  'Dépendance affective',
  'Traumatismes',
  'Angoisses existentielles',
  'Reconstruction après une relation toxique',
];

// Diplômes et reconnaissances réels (source : page À Propos).
const CREDENTIALS = [
  {
    '@type': 'EducationalOccupationalCredential',
    credentialCategory: 'diploma',
    name: 'Diplôme de Rêve Éveillé Libre',
    recognizedBy: {
      '@type': 'EducationalOrganization',
      name: 'École du Rêve Éveillé Libre (EREL)',
      address: { '@type': 'PostalAddress', addressLocality: 'Paris', addressCountry: 'FR' },
    },
  },
  {
    '@type': 'EducationalOccupationalCredential',
    credentialCategory: 'certificate',
    name: 'Certification Spirivie — Coaching de Vie',
  },
  {
    '@type': 'EducationalOccupationalCredential',
    credentialCategory: 'certification',
    name: 'Praticien validé IPHM',
    recognizedBy: {
      '@type': 'Organization',
      name: 'International Practitioners of Holistic Medicine (IPHM)',
    },
  },
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

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://audeladeschaines.com/#website',
        url: 'https://audeladeschaines.com',
        name: business.name,
        inLanguage: 'fr-CH',
        publisher: { '@id': 'https://audeladeschaines.com/#organization' },
        about: { '@id': 'https://audeladeschaines.com/#matthieu-le-tousse' },
      },
      {
        '@type': 'Person',
        '@id': 'https://audeladeschaines.com/#matthieu-le-tousse',
        name: 'Matthieu Le Tousse',
        givenName: 'Matthieu',
        familyName: 'Le Tousse',
        jobTitle: 'Coach Relation Toxique & Pervers Narcissique',
        description:
          "Coach spécialisé dans la sortie d'emprise, les relations toxiques et le pervers narcissique. Plus de 20 ans d'expérience dans le champ des relations toxiques et 6 ans de consultation thérapeutique individuelle en cabinet privé, aujourd'hui dédié à l'accompagnement de la dépendance et de l'emprise relationnelle.",
        url: 'https://audeladeschaines.com',
        image: PHOTO_URL,
        knowsAbout: KNOWS_ABOUT,
        hasCredential: CREDENTIALS,
        alumniOf: {
          '@type': 'EducationalOrganization',
          name: 'École du Rêve Éveillé Libre (EREL)',
          address: { '@type': 'PostalAddress', addressLocality: 'Paris', addressCountry: 'FR' },
        },
        address: postalAddress,
        ...(sameAs.length ? { sameAs } : {}),
        worksFor: { '@id': 'https://audeladeschaines.com/#organization' },
      },
      {
        '@type': 'ProfessionalService',
        '@id': 'https://audeladeschaines.com/#organization',
        name: business.name,
        alternateName: `${business.owner} — Coaching`,
        description:
          "Accompagnement et coaching pour victimes de relations toxiques, d'emprise psychologique et de pervers narcissique.",
        url: 'https://audeladeschaines.com',
        image: PHOTO_URL,
        logo: LOGO_URL,
        founder: { '@id': 'https://audeladeschaines.com/#matthieu-le-tousse' },
        address: postalAddress,
        telephone: business.phone.replace(/\s+/g, ''),
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: business.phone.replace(/\s+/g, ''),
          contactType: 'customer service',
          availableLanguage: ['fr'],
        },
        // Présentiel dans le canton de Vaud (siège de l'activité) + séances à
        // distance / visio pour toute la Suisse et la francophonie.
        areaServed: [
          { '@type': 'AdministrativeArea', name: 'Canton de Vaud', containedInPlace: { '@type': 'Country', name: 'Suisse' } },
          { '@type': 'Country', name: 'Suisse' },
          { '@type': 'Country', name: 'France' },
          { '@type': 'Country', name: 'Belgique' },
          { '@type': 'Country', name: 'Canada' },
        ],
        // Gamme confirmée par Matthieu (2026-07) : 450 CHF (accès seul, sans
        // coaching privé) à 1295 CHF (coaching individuel, tarif normal — prix
        // de lancement actuel 895 CHF, promotionnel donc non reflété ici).
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
  // Profil Google Business officiel (signal d'autorité externe pour l'entité).
  const GOOGLE_PROFILE = 'https://share.google/3SjbvnmLq5JvHf3a8';
  // dédoublonnage : social_youtube pointe parfois vers la même URL que LinkedIn.
  const sameAs = Array.from(
    new Set(
      [
        social.social_linkedin,
        social.social_instagram,
        social.social_youtube,
        social.social_spotify,
        GOOGLE_PROFILE,
      ].filter(Boolean)
    )
  );
  const structuredData = buildStructuredData(sameAs, business);

  return (
    <html lang="fr" className={`${inter.variable} ${playfair.variable}`}>
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
