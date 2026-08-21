/**
 * Configuration globale du site.
 *
 * Valeurs de repli du template : elles ne sont utilisées que tant que la table
 * `settings` est vide. Dès la première installation, tout se règle depuis
 * l'admin (Paramètres > Entreprise, Éditorial & Marque, Design & Style).
 *
 * ⚠️ Ne jamais écrire ici le nom, l'adresse ou l'URL d'un client : ces valeurs
 * suivraient le template d'installation en installation.
 */

import { getSettingsServer } from '../services/settingsServer';

export const SITE_CONFIG = {
  name: "",
  owner: "",

  // URL canonique — base des canonicals, du sitemap, de robots.txt, des @id
  // Schema.org et des liens de partage.
  //
  // Ordre de résolution, et pourquoi il compte :
  //  1. NEXT_PUBLIC_SITE_URL — le seul injecté AUSSI dans le bundle navigateur
  //     (préfixe NEXT_PUBLIC_). C'est celui à définir.
  //  2. URL — injecté automatiquement par Netlify, mais côté serveur
  //     uniquement : dans le navigateur il vaut undefined.
  //  3. Le repli local, qui n'a de sens qu'en développement.
  url: process.env.NEXT_PUBLIC_SITE_URL ||
       process.env.URL ||
       "http://localhost:5173",

  // E-mail de réception des formulaires. Pas de repli inventé : une adresse
  // fictive ferait échouer les envois en silence.
  receiverEmail: process.env.CONTACT_EMAIL || "",

  // Resend exige un domaine vérifié pour l'expéditeur. Tant qu'il n'existe
  // pas, laisser vide (les envois échouent proprement) ou utiliser
  // onboarding@resend.dev pour les tests.
  emailSender: {
    name: "",
    email: process.env.RESEND_FROM_EMAIL || "",
    get full() {
      return `${this.name} <${this.email}>`;
    }
  },

  // Indexation IndexNow (Bing). À définir par site.
  bingIndexNowKey: process.env.BING_INDEXNOW_KEY || "",

  // Métadonnées SEO de repli, à renseigner depuis l'admin.
  seoDefaults: {
    title: "",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    keywords: "",
  }
};

export interface BusinessInfo {
  name: string;
  owner: string;
  email: string;
  phone: string;
  addressStreet: string;
  addressPostal: string;
  addressCity: string;
  addressRegion: string;
  addressCountry: string;
  priceRange: string;
}

/**
 * Coordonnées d'entreprise éditables depuis l'admin (Paramètres > Entreprise),
 * avec repli sur les valeurs statiques ci-dessus si la table `settings` est
 * indisponible. À utiliser côté serveur uniquement (pages/route handlers).
 */
export async function getBusinessInfoServer(): Promise<BusinessInfo> {
  const s = await getSettingsServer([
    'business_name',
    'business_owner',
    'business_email',
    'business_phone',
    'business_address_street',
    'business_address_postal',
    'business_address_city',
    'business_address_region',
    'business_address_country',
    'business_price_range',
  ]);
  return {
    name: s.business_name || SITE_CONFIG.name,
    owner: s.business_owner || SITE_CONFIG.owner,
    email: s.business_email || SITE_CONFIG.receiverEmail,
    phone: s.business_phone,
    addressStreet: s.business_address_street,
    addressPostal: s.business_address_postal,
    addressCity: s.business_address_city,
    addressRegion: s.business_address_region,
    addressCountry: s.business_address_country,
    priceRange: s.business_price_range,
  };
}
