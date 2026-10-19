/**
 * E-mails aux clientes (réservations) : textes, mots-clés et mise en forme.
 *
 * Les textes se modifient dans Réglages › Réservations › « E-mails aux
 * clientes » ; ceux qui n'ont jamais été modifiés gardent la version ci-dessous.
 * Ils sont rangés, en JSON, dans le réglage `booking_email_templates`.
 *
 * Module pur, sans accès serveur : l'envoi (services/booking.ts) et l'aperçu
 * de l'admin passent par `renderClientMail`, donc l'aperçu montre exactement
 * ce qui part.
 *
 * Syntaxe du message, volontairement minimale :
 *  - une ligne vide sépare deux paragraphes ;
 *  - `**texte**` met en gras, `# ` en début de paragraphe en fait un titre ;
 *  - `{prenom}`, `{date}`… sont remplacés (voir MAIL_VARIABLES) ;
 *  - `{recapitulatif}` insère l'encadré soin / date / heure / tarif.
 * Tout le reste est échappé : aucun HTML saisi ne passe tel quel.
 */
import type { Booking } from '../types/booking';
import { PERIODE_LABEL, bookingTotal } from '../types/booking';

export type ClientMailKind = 'accuse' | 'confirmation' | 'deplacement' | 'annulation' | 'refus' | 'rappel';

export interface MailText {
  subject: string;
  body: string;
}

export type MailTextOverrides = Partial<Record<ClientMailKind, MailText>>;

export interface Biz {
  name: string;
  /** Prénom et nom de la gérante (onglet Entreprise). */
  owner?: string;
  phone: string;
  email: string;
  address: string;
}

export const SUBJECT_MAX = 200;
export const BODY_MAX = 5000;

/** Ordre d'affichage dans l'admin, et à quel moment chaque e-mail part. */
export const CLIENT_MAILS: { kind: ClientMailKind; label: string; when: string }[] = [
  { kind: 'accuse', label: 'Accusé de réception', when: 'Dès qu\'une cliente envoie une demande depuis le site.' },
  { kind: 'confirmation', label: 'Confirmation', when: 'Quand vous confirmez le rendez-vous avec un horaire.' },
  { kind: 'rappel', label: 'Rappel de la veille', when: 'Automatiquement la veille du rendez-vous confirmé, vers 10 h.' },
  { kind: 'deplacement', label: 'Rendez-vous déplacé', when: 'Quand vous changez la date ou l\'heure d\'un rendez-vous confirmé.' },
  { kind: 'annulation', label: 'Annulation', when: 'Quand vous annulez un rendez-vous.' },
  { kind: 'refus', label: 'Demande déclinée', when: 'Quand vous refusez une demande.' },
];

export const MAIL_VARIABLES: { key: string; label: string; only?: ClientMailKind[] }[] = [
  { key: 'prenom', label: 'Prénom de la cliente' },
  { key: 'nom', label: 'Nom de la cliente' },
  { key: 'soin', label: 'Soin' },
  { key: 'date', label: 'Date (mercredi 14 octobre 2026)' },
  { key: 'jour', label: 'Jour (mercredi 14 octobre)' },
  { key: 'heure', label: 'Heure' },
  { key: 'date_heure', label: 'Date, et heure si elle est fixée' },
  { key: 'periode', label: 'Matin ou après-midi' },
  { key: 'ancienne_date', label: 'Ancienne date', only: ['deplacement'] },
  { key: 'ancienne_heure', label: 'Ancienne heure', only: ['deplacement'] },
  { key: 'telephone', label: 'Votre téléphone' },
  { key: 'lieu', label: 'Adresse de l\'institut' },
  { key: 'institut', label: 'Nom de l\'institut' },
  { key: 'gerante', label: 'Votre prénom' },
  { key: 'recapitulatif', label: 'Encadré récapitulatif' },
];

export const DEFAULT_MAIL_TEXTS: Record<ClientMailKind, MailText> = {
  accuse: {
    subject: 'Votre demande de rendez-vous — {date_heure}',
    body: `Bonjour {prenom},

Nous avons bien reçu votre demande de rendez-vous pour le **{date_heure}**.

{recapitulatif}

**Votre rendez-vous n'est pas encore confirmé.** Votre horaire vous est réservé ; {gerante} vous recontacte prochainement pour le confirmer.

À bientôt,
**{institut}**
{lieu}`,
  },
  confirmation: {
    subject: 'Rendez-vous confirmé le {date} à {heure}',
    body: `# Votre rendez-vous est confirmé

Bonjour {prenom},

Je me réjouis de vous accueillir.

{recapitulatif}

Prévoyez quelques minutes d'avance pour vous installer sereinement. En cas d'imprévu, merci de me prévenir au moins 24 heures à l'avance au {telephone}.

À très bientôt,
**{gerante}**`,
  },
  rappel: {
    subject: 'Rappel : votre rendez-vous demain à {heure}',
    body: `Bonjour {prenom},

Petit rappel : je vous attends **demain, {jour}, à {heure}**.

{recapitulatif}

En cas d'imprévu, merci de me prévenir au plus vite au {telephone}.

À demain,
**{gerante}**`,
  },
  deplacement: {
    subject: 'Votre rendez-vous est déplacé au {date} à {heure}',
    body: `# Votre rendez-vous a changé de date ou d'heure

Bonjour {prenom},

Votre rendez-vous initialement prévu le {ancienne_date} à {ancienne_heure} est **déplacé**.

{recapitulatif}

Si ce nouvel horaire ne vous convient pas, appelez-moi au {telephone} pour que nous trouvions une autre date.

Avec mes excuses pour le changement,
**{gerante}**`,
  },
  annulation: {
    subject: 'Votre rendez-vous du {date} est annulé',
    body: `Bonjour {prenom},

Votre rendez-vous du **{date_heure}** ({soin}) est annulé.

Pour convenir d'une nouvelle date, vous pouvez me joindre au {telephone} ou réserver à nouveau en ligne.

Avec mes salutations,
**{gerante}**`,
  },
  refus: {
    subject: 'À propos de votre demande de rendez-vous',
    body: `Bonjour {prenom},

Je n'ai malheureusement pas la possibilité de vous accueillir le **{date}** ({soin}).

Je serais ravie de trouver avec vous une autre date : vous pouvez me joindre au {telephone} ou réserver à nouveau en ligne.

Avec mes salutations,
**{gerante}**`,
  },
};

// ── Mise en forme partagée (aussi utilisée par l'e-mail à l'institut) ────────

/** Échappe tout texte interpolé dans du HTML (nom, notes, soin, ville…). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `CHF 1'234.50` : convention suisse (de-CH), centimes affichés dès qu'il y en a. */
export function chfMail(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const fraction = Number.isInteger(v) ? 0 : 2;
  return `CHF ${new Intl.NumberFormat('de-CH', { minimumFractionDigits: fraction, maximumFractionDigits: 2 }).format(v)}`;
}

/** « lundi 5 octobre 2026 », calculé en Zurich quel que soit le fuseau du serveur. */
export function formatDateLong(date: string): string {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zurich',
  });
}

export function mailRow(label: string, valueHtml: string): string {
  return `<p style="margin:0 0 6px;"><strong>${escapeHtml(label)}</strong> ${valueHtml}</p>`;
}

export function mailShell(innerHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1917;max-width:560px;">${innerHtml}</div>`;
}

function summaryBlock(b: Booking, rows: string[]): string {
  const opts = b.options.length
    ? `<p style="margin:0 0 6px;"><strong>En plus :</strong> ${b.options.map((o) => escapeHtml(o.nom)).join(', ')}</p>`
    : '';
  return `<div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:16px 0;">
    ${rows.join('\n')}
    <p style="margin:0 0 6px;"><strong>Soin :</strong> ${escapeHtml(b.service_nom)}</p>
    ${opts}
    <p style="margin:0 0 6px;"><strong>Durée :</strong> ${b.service_duree_minutes} minutes</p>
    <p style="margin:0;"><strong>Tarif :</strong> ${escapeHtml(chfMail(b.total_chf ?? bookingTotal(b)))}</p>
  </div>`;
}

// ── Textes enregistrés ───────────────────────────────────────────────────────

function isMailText(v: unknown): v is MailText {
  const t = v as MailText;
  return !!t && typeof t.subject === 'string' && typeof t.body === 'string' && !!t.subject.trim() && !!t.body.trim();
}

/** Lit le réglage `booking_email_templates` ; toute valeur abîmée retombe sur le texte d'origine. */
export function parseMailOverrides(raw: string | null | undefined): MailTextOverrides {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: MailTextOverrides = {};
    for (const { kind } of CLIENT_MAILS) {
      const t = obj?.[kind];
      if (isMailText(t)) out[kind] = { subject: t.subject.slice(0, SUBJECT_MAX), body: t.body.slice(0, BODY_MAX) };
    }
    return out;
  } catch {
    return {};
  }
}

export function mailTextFor(kind: ClientMailKind, overrides: MailTextOverrides | undefined): MailText {
  return overrides?.[kind] ?? DEFAULT_MAIL_TEXTS[kind];
}

/** Mots entre accolades qui ne correspondent à aucun mot-clé (faute de frappe). */
export function unknownVariables(text: string): string[] {
  const known = new Set(MAIL_VARIABLES.map((v) => v.key));
  const found = new Set<string>();
  for (const m of text.matchAll(/\{([^{}\s]{1,40})\}/g)) if (!known.has(m[1])) found.add(`{${m[1]}}`);
  return [...found];
}

// ── Rendu ────────────────────────────────────────────────────────────────────

function mailVariables(b: Booking, biz: Biz, previous: Booking | undefined) {
  const date = formatDateLong(b.date_rdv);
  const heure = b.heure_rdv ?? '';
  const old = previous ?? b;
  const gerante = (biz.owner || '').trim().split(/\s+/)[0] || biz.name;
  const text: Record<string, string> = {
    prenom: b.prenom,
    nom: b.nom,
    soin: b.service_nom,
    date,
    jour: date.replace(/,/g, '').replace(/\s\d{4}$/, ''),
    heure,
    date_heure: b.horaire_fixe && heure ? `${date} à ${heure}` : date,
    periode: PERIODE_LABEL[b.periode ?? 'matin'].toLowerCase(),
    ancienne_date: formatDateLong(old.date_rdv),
    ancienne_heure: old.heure_rdv ?? '',
    telephone: biz.phone,
    lieu: biz.address,
    institut: biz.name,
    gerante,
  };
  const html: Record<string, string> = Object.fromEntries(Object.entries(text).map(([k, v]) => [k, escapeHtml(v)]));
  if (biz.phone) html.telephone = `<a href="tel:${escapeHtml(biz.phone.replace(/\s+/g, ''))}">${escapeHtml(biz.phone)}</a>`;
  return { text, html };
}

function recapRows(kind: ClientMailKind, b: Booking, v: Record<string, string>): string[] {
  const lieu = mailRow('Lieu :', v.lieu);
  const heure = `<strong>${v.heure}</strong>`;
  switch (kind) {
    case 'accuse':
      return b.horaire_fixe
        ? [mailRow('Date souhaitée :', v.date), mailRow('Heure souhaitée :', heure)]
        : [mailRow('Date souhaitée :', `${v.date} — ${v.periode}`)];
    case 'deplacement':
      return [mailRow('Nouvelle date :', v.date), mailRow('Nouvelle heure :', heure), lieu];
    case 'confirmation':
    case 'rappel':
      return [mailRow('Date :', v.date), mailRow('Heure :', heure), lieu];
    default:
      return b.horaire_fixe ? [mailRow('Date :', v.date), mailRow('Heure :', heure)] : [mailRow('Date :', v.date)];
  }
}

function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{([a-z_]+)\}/g, (m, k: string) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m));
}

export function renderClientMail(
  kind: ClientMailKind,
  text: MailText,
  b: Booking,
  biz: Biz,
  previous?: Booking,
): { subject: string; html: string } {
  const v = mailVariables(b, biz, previous);
  const recap = summaryBlock(b, recapRows(kind, b, v.html));
  const blocks = text.body
    .replace(/\r\n?/g, '\n')
    .replace(/\{recapitulatif\}/g, '\n\n{recapitulatif}\n\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const html = blocks
    .map((p) => {
      if (p === '{recapitulatif}') return recap;
      const heading = p.startsWith('# ');
      const inner = fill(escapeHtml(heading ? p.slice(2) : p), v.html)
        .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
      return heading
        ? `<h2 style="font-size:18px;margin:0 0 12px;">${inner}</h2>`
        : `<p style="margin:0 0 14px;">${inner}</p>`;
    })
    .join('\n');

  return { subject: fill(text.subject, v.text), html: mailShell(html) };
}
