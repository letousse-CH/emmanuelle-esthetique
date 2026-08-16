/**
 * Promotions — e-mail et WhatsApp.
 *
 * ┌─ LA RÈGLE QUI GOUVERNE CE FICHIER ─────────────────────────────────────┐
 * │ Encaisser quelqu'un n'est pas un consentement publicitaire.            │
 * │ La LCD (art. 3 al. 1 let. o) exige un accord préalable pour la         │
 * │ publicité de masse par e-mail ou message. Toute construction           │
 * │ d'audience passe donc par `buildAudience`, qui ne retient que les      │
 * │ destinataires ayant consenti — jamais un `listClients()` brut.         │
 * └────────────────────────────────────────────────────────────────────────┘
 */
import type { Client, ClientStats } from './caisse';
import { clientBirthMonth, clientFullName, moisDepuis } from './caisse';

export type PromotionCanal = 'email' | 'whatsapp' | 'les_deux';
export type PromotionStatus = 'brouillon' | 'en_cours' | 'envoyee';
export type SendCanal = 'email' | 'whatsapp';

export const CANAL_LABELS: Record<PromotionCanal, string> = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  les_deux: 'E-mail + WhatsApp',
};

export interface Promotion {
  id: string;
  nom: string;
  canal: PromotionCanal;
  segment: SegmentKey;
  segment_params: { mois?: number; visites?: number };
  objet: string | null;
  message_email: string | null;
  message_whatsapp: string | null;
  status: PromotionStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionSend {
  id: string;
  promotion_id: string;
  client_id: string | null;
  subscriber_id: string | null;
  canal: SendCanal;
  destinataire: string;
  status: 'envoye' | 'echec';
  error: string | null;
  created_at: string;
}

/** Abonné newsletter du site, tel que le module Audience le stocke. */
export interface Subscriber {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
}

// ── Segments ────────────────────────────────────────────────────────────────

export type SegmentKey = 'toutes' | 'anniversaires' | 'inactives' | 'fideles' | 'abonnes';

export const SEGMENTS: {
  key: SegmentKey;
  label: string;
  help: string;
  /** Paramètre réglable, s'il y en a un. */
  param?: { name: 'mois' | 'visites'; label: string; default: number };
}[] = [
  {
    key: 'toutes',
    label: 'Toute l’audience',
    help: 'Clientes ayant donné leur accord, plus les abonnés de la newsletter du site.',
  },
  {
    key: 'anniversaires',
    label: 'Anniversaires du mois',
    help: 'Clientes dont l’anniversaire tombe ce mois-ci.',
    param: { name: 'mois', label: 'Mois', default: 0 },
  },
  {
    key: 'inactives',
    label: 'Clientes à relancer',
    help: 'Venues au moins une fois, mais plus depuis un moment.',
    param: { name: 'mois', label: 'Sans visite depuis (mois)', default: 6 },
  },
  {
    key: 'fideles',
    label: 'Clientes fidèles',
    help: 'Celles qui reviennent — à partir d’un nombre de visites.',
    param: { name: 'visites', label: 'Visites minimum', default: 5 },
  },
  {
    key: 'abonnes',
    label: 'Abonnés newsletter',
    help: 'Uniquement les inscrits du site. Pas de numéro, donc pas de WhatsApp.',
  },
];

export function segmentLabel(key: SegmentKey): string {
  return SEGMENTS.find(s => s.key === key)?.label ?? key;
}

// ── Audience ────────────────────────────────────────────────────────────────

/**
 * Un destinataire retenu. `key` est stable et sert de clé de rendu comme de
 * clé de déduplication : l'e-mail en minuscules quand il y en a un, sinon
 * l'identifiant de la fiche (les clientes sans e-mail restent joignables par
 * WhatsApp).
 */
export interface AudienceEntry {
  key: string;
  clientId: string | null;
  subscriberId: string | null;
  nom: string;
  email: string | null;
  telephone: string | null;
  /** Numéro normalisé E.164 sans « + », prêt pour un lien wa.me. */
  waNumber: string | null;
  joignableEmail: boolean;
  joignableWhatsapp: boolean;
}

export interface AudienceInput {
  clients: Client[];
  stats: Map<string, ClientStats>;
  subscribers: Subscriber[];
  segment: SegmentKey;
  params: { mois?: number; visites?: number };
  /** Mois courant (1–12), injecté pour rester testable. */
  moisCourant?: number;
}

/**
 * Construit l'audience d'une promotion.
 *
 * Deux gardes valent d'être explicites :
 *  · le consentement est vérifié PAR CANAL — une cliente qui accepte les
 *    e-mails mais pas WhatsApp entre dans l'audience sans être joignable sur
 *    WhatsApp, elle n'en disparaît pas pour autant ;
 *  · la déduplication se fait sur l'e-mail en minuscules, et la fiche cliente
 *    l'emporte sur l'abonné : elle porte un nom, un numéro et un historique.
 *    Un abonné du site qui est aussi cliente ne reçoit donc qu'un exemplaire.
 *
 * Un abonné actif du site a consenti en s'inscrivant : sa présence dans
 * `subscribers` avec `active = true` vaut opt-in e-mail, même si la fiche
 * cliente correspondante n'a jamais coché la case.
 */
export function buildAudience(input: AudienceInput): AudienceEntry[] {
  const { clients, stats, subscribers, segment, params } = input;
  const mois = input.moisCourant ?? new Date().getMonth() + 1;

  const abonnesActifs = new Map<string, Subscriber>();
  for (const s of subscribers) {
    if (!s.active || !s.email) continue;
    abonnesActifs.set(s.email.trim().toLowerCase(), s);
  }

  const entries: AudienceEntry[] = [];
  const vus = new Set<string>();

  if (segment !== 'abonnes') {
    for (const c of clients) {
      if (c.archived) continue;

      const email = (c.email ?? '').trim().toLowerCase() || null;
      const abonne = email ? abonnesActifs.get(email) : undefined;
      const joignableEmail = Boolean(email) && (c.consent_email || Boolean(abonne));
      const waNumber = toWhatsAppNumber(c.telephone);
      const joignableWhatsapp = c.consent_whatsapp && waNumber !== null;

      if (!joignableEmail && !joignableWhatsapp) continue;
      if (!matchSegment(c, stats.get(c.id), segment, params, mois)) continue;

      const key = email ?? `client:${c.id}`;
      if (vus.has(key)) continue;
      vus.add(key);

      entries.push({
        key,
        clientId: c.id,
        subscriberId: abonne?.id ?? null,
        nom: clientFullName(c) || (email ?? ''),
        email,
        telephone: c.telephone,
        waNumber,
        joignableEmail,
        joignableWhatsapp,
      });
    }
  }

  // Abonnés du site sans fiche cliente : joignables par e-mail uniquement.
  if (segment === 'toutes' || segment === 'abonnes') {
    for (const [email, s] of abonnesActifs) {
      if (vus.has(email)) continue;
      vus.add(email);
      entries.push({
        key: email,
        clientId: null,
        subscriberId: s.id,
        nom: email,
        email,
        telephone: null,
        waNumber: null,
        joignableEmail: true,
        joignableWhatsapp: false,
      });
    }
  }

  return entries.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

function matchSegment(
  c: Client,
  st: ClientStats | undefined,
  segment: SegmentKey,
  params: { mois?: number; visites?: number },
  moisCourant: number,
): boolean {
  switch (segment) {
    case 'toutes':
      return true;
    case 'anniversaires': {
      const cible = params.mois && params.mois >= 1 && params.mois <= 12 ? params.mois : moisCourant;
      return clientBirthMonth(c) === cible;
    }
    case 'inactives': {
      // Jamais venue ≠ inactive : une fiche créée hier n'a rien à se faire
      // reprocher. Le segment vise celles qui venaient et ne viennent plus.
      const visites = Number(st?.nb_visites ?? 0);
      if (visites === 0) return false;
      const ecoules = moisDepuis(st?.derniere_visite ?? null);
      return ecoules !== null && ecoules >= (params.mois ?? 6);
    }
    case 'fideles':
      return Number(st?.nb_visites ?? 0) >= (params.visites ?? 5);
    default:
      return false;
  }
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

/**
 * Indicatif par défaut quand le numéro est saisi en format national (076…).
 * L'institut est en Suisse ; un numéro déjà international (+33…) est respecté.
 */
const INDICATIF_DEFAUT = '41';

/**
 * Normalise un téléphone en numéro E.164 sans « + », tel que l'attend wa.me.
 * Renvoie `null` si le résultat n'est pas plausible — mieux vaut ne pas
 * proposer de lien que d'en proposer un qui ouvre une conversation avec un
 * inconnu.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const international = trimmed.startsWith('+') || trimmed.startsWith('00');
  let digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('00')) digits = digits.slice(2);
  else if (!international && digits.startsWith('0')) digits = INDICATIF_DEFAUT + digits.slice(1);
  else if (!international && digits.length === 9) digits = INDICATIF_DEFAUT + digits;

  // 8 chiffres au minimum (indicatif compris), 15 au maximum : c'est la borne
  // de la norme E.164.
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Lien qui ouvre WhatsApp avec le message déjà rédigé. */
export function whatsappLink(waNumber: string, message: string): string {
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * Remplace les variables du message. Volontairement limité à deux : un moteur
 * de gabarit complet inviterait à personnaliser ce qu'on ne maîtrise pas, et
 * un champ vide produirait « Bonjour  , » dans un message parti à cinquante
 * personnes.
 */
export function renderMessage(template: string, entry: Pick<AudienceEntry, 'nom'>): string {
  const prenom = entry.nom.split(' ')[0] || '';
  return template
    .replace(/\{\{\s*prenom\s*\}\}/gi, prenom)
    .replace(/\{\{\s*nom\s*\}\}/gi, entry.nom);
}

export const VARIABLES_DISPONIBLES = [
  { token: '{{prenom}}', help: 'Prénom de la destinataire' },
  { token: '{{nom}}', help: 'Nom complet' },
];
