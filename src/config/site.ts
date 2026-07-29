/**
 * Configuration globale du site "Au-delà des Chaînes".
 * Centralise les informations autrefois codées en dur pour faciliter le portage
 * et la gestion multi-environnement.
 */

import { getSettingsServer } from '../services/settingsServer';

export const SITE_CONFIG = {
  name: "Au-delà des Chaînes",
  owner: "Matthieu Le Tousse",
  
  // URL canonique du site
  url: process.env.NEXT_PUBLIC_SITE_URL || 
       process.env.URL || 
       "https://audeladeschaines.com",

  // E-mail où l'on reçoit les formulaires de contact / notifications de paiement
  receiverEmail: process.env.CONTACT_EMAIL || "letousse@gmail.com",

  // Configuration d'envoi via Resend
  emailSender: {
    name: "Matthieu Le Tousse",
    // Adresse d'expédition validée dans Resend
    email: process.env.RESEND_FROM_EMAIL || "contact@audeladeschaines.com",
    get full() {
      return `${this.name} <${this.email}>`;
    }
  },

  // Indexation Search Engines (IndexNow de Bing)
  bingIndexNowKey: process.env.BING_INDEXNOW_KEY || "semeurdeveil",

  // Métadonnées SEO par défaut du site (coaching emprise/relation toxique)
  seoDefaults: {
    title: "Comprendre l'Emprise, Briser les Chaînes et Se Reconstruire | Matthieu Le Tousse",
    description: "Bénéficiez d'un accompagnement pragmatique, direct et orienté résultats pour décoder les mécanismes de manipulation, poser des limites et reprendre définitivement les commandes de votre vie.",
    ogTitle: "Coaching Relation Toxique & Emprise Psychologique | Matthieu Le Tousse",
    ogDescription: "Décodez les mécanismes de manipulation fine ou perverse et posez des limites infranchissables. Reprenez les commandes de votre vie.",
    ogImage: "https://pub-06788dc2f8884cb1bba449c00813d758.r2.dev/1782229256675-Matthieu-Le-Tousse.webp",
    keywords: "coaching relation toxique, emprise psychologique, pervers narcissique, manipulation mentale, se reconstruire après emprise, Matthieu Le Tousse",
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
