/**
 * Configuration globale du site "Emmanuelle Esthétique".
 * Centralise les informations autrefois codées en dur pour faciliter le portage
 * et la gestion multi-environnement.
 */

import { getSettingsServer } from '../services/settingsServer';

export const SITE_CONFIG = {
  name: "Emmanuelle Esthétique",
  owner: "Emmanuelle",

  // URL canonique du site
  url: process.env.NEXT_PUBLIC_SITE_URL ||
       process.env.URL ||
       "https://emmanuelle-esthetique.ch",

  // E-mail où l'on reçoit les formulaires de contact / notifications de paiement
  receiverEmail: process.env.CONTACT_EMAIL || "contact@emmanuelle-esthetique.ch",

  // Configuration d'envoi via Resend
  emailSender: {
    name: "Emmanuelle Esthétique",
    // Adresse d'expédition validée dans Resend
    email: process.env.RESEND_FROM_EMAIL || "contact@emmanuelle-esthetique.ch",
    get full() {
      return `${this.name} <${this.email}>`;
    }
  },

  // Indexation Search Engines (IndexNow de Bing)
  bingIndexNowKey: process.env.BING_INDEXNOW_KEY || "emmanuelleesthetique",

  // Métadonnées SEO par défaut du site (institut de beauté à domicile)
  seoDefaults: {
    title: "Institut de beauté à domicile à Palézieux | Emmanuelle Esthétique",
    description: "Soins du visage, Head Spa, massages et ateliers bien-être dans un cocon à domicile à Palézieux. Une parenthèse de douceur, en toute bienveillance.",
    ogTitle: "Emmanuelle Esthétique — Soins & bien-être à Palézieux",
    ogDescription: "Soins du visage doux et naturels, Head Spa, massages relaxants et ateliers Gua Sha dans un institut à domicile à Palézieux.",
    ogImage: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=1200",
    keywords: "institut de beauté Palézieux, soin du visage Palézieux, head spa Vaud, massage relaxant Palézieux, atelier Gua Sha, esthéticienne à domicile Vaud",
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
