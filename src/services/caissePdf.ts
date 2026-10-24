/**
 * Rendu des PDF de la caisse (quittance, bon cadeau), côté serveur Node.
 *
 * Partagé par les routes de téléchargement de l'administration et par l'envoi
 * du bon commandé en ligne : la cliente reçoit exactement le document que
 * l'exploitante imprimerait.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import FactureDocument from '../components/pdf/FactureDocument';
import BonCadeauDocument, { type BonImages, type PdfImage } from '../components/pdf/BonCadeauDocument';
import { BON_ALGUE_PNG, BON_PHOTO_JPG } from '../components/pdf/bonCadeauAssets';
import { SITE_CONFIG, getBusinessInfoServer } from '../config/site';
import { getSettingsServer } from './settingsServer';
import { compositionResume } from '../types/caisse';
import type { GiftCard, SubscriptionCredit, TransactionWithItems } from '../types/caisse';

export class PdfError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PdfError';
    this.status = status;
  }
}

export interface RenderedPdf {
  buffer: Buffer;
  filename: string;
}

export async function renderFacturePdf(db: SupabaseClient, id: string): Promise<RenderedPdf> {
  const { data, error } = await db
    .from('transactions')
    .select('*, transaction_items(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new PdfError(500, error.message);
  if (!data) throw new PdfError(404, 'Facture introuvable.');

  const transaction = data as TransactionWithItems;
  transaction.transaction_items = [...(transaction.transaction_items ?? [])]
    .sort((a, b) => a.ordre - b.ordre);

  const [business, s, emisRes, utiliseRes, abosRes] = await Promise.all([
    getBusinessInfoServer(),
    getSettingsServer([
      'caisse_tva_assujetti',
      'caisse_tva_numero',
      'caisse_iban',
      'caisse_facture_mentions',
    ]),
    // Bons vendus par cette facture : leur code doit y figurer, c'est la
    // preuve remise à l'acheteuse.
    db
      .from('gift_cards')
      .select('code, libelle, montant_initial, expire_le')
      .eq('sale_transaction_id', id)
      .order('number_seq', { ascending: true }),
    // Bon présenté en paiement, s'il y en a un.
    transaction.gift_card_id
      ? db
          .from('gift_cards')
          .select('code, montant_restant')
          .eq('id', transaction.gift_card_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Abonnements ouverts par cette facture : code, séances et échéance.
    transaction.transaction_items.some(i => i.subscription_id)
      ? db
          .from('subscriptions')
          .select('code, libelle, expire_le, subscription_credits(libelle, seances, offertes, ordre)')
          .eq('sale_transaction_id', id)
          .order('number_seq', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const abonnements = (abosRes.data ?? []).map((a: {
    code: string; libelle: string; expire_le: string;
    subscription_credits: Pick<SubscriptionCredit, 'libelle' | 'seances' | 'offertes' | 'ordre'>[];
  }) => ({
    code: a.code,
    libelle: a.libelle,
    seances: compositionResume([...(a.subscription_credits ?? [])].sort((x, y) => x.ordre - y.ordre)),
    expireLe: a.expire_le,
  }));

  const giftCards = {
    emis: (emisRes.data ?? []).map((g: {
      code: string; libelle: string; montant_initial: number; expire_le: string;
    }) => ({
      code: g.code,
      libelle: g.libelle,
      montant: Number(g.montant_initial),
      expireLe: g.expire_le,
    })),
    utilise: utiliseRes.data
      ? {
          code: (utiliseRes.data as { code: string }).code,
          montant: Number(transaction.montant_bon),
          restant: Number((utiliseRes.data as { montant_restant: number }).montant_restant),
        }
      : null,
  };

  // `renderToBuffer` exige un élément <Document> à la racine : on appelle
  // donc `FactureDocument` comme une simple fonction pour récupérer ce
  // <Document>, plutôt que de l'envelopper dans un composant intermédiaire
  // que le typage de react-pdf refuserait.
  const buffer = await renderToBuffer(
    FactureDocument({
      transaction,
      business,
      settings: {
        tvaAssujetti: s.caisse_tva_assujetti === 'true',
        tvaNumero: s.caisse_tva_numero,
        iban: s.caisse_iban,
        mentions: s.caisse_facture_mentions,
      },
      giftCards,
      abonnements,
    }),
  );

  return { buffer, filename: `${transaction.numero}.pdf` };
}

export async function renderBonCadeauPdf(db: SupabaseClient, id: string): Promise<RenderedPdf> {
  const { data, error } = await db
    .from('gift_cards')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new PdfError(500, error.message);
  if (!data) throw new PdfError(404, 'Bon cadeau introuvable.');

  const card = data as GiftCard;
  if (card.status === 'annule') {
    throw new PdfError(409, 'Ce bon a été annulé : il ne peut pas être imprimé.');
  }

  const [business, s] = await Promise.all([
    getBusinessInfoServer(),
    getSettingsServer(['caisse_bon_mentions', 'caisse_bon_image', 'footer_logo']),
  ]);
  const images = await loadBonImages(s.caisse_bon_image, s.footer_logo);

  const buffer = await renderToBuffer(
    BonCadeauDocument({ card, business, mentions: s.caisse_bon_mentions, images, bookingUrl: bookingUrl() }),
  );

  return { buffer, filename: `${card.code}.pdf` };
}

// ── Images du bon ────────────────────────────────────────────────────────────

const BUNDLED_PHOTO: PdfImage = { data: Buffer.from(BON_PHOTO_JPG, 'base64'), format: 'jpg' };
const BUNDLED_ALGUE: PdfImage = { data: Buffer.from(BON_ALGUE_PNG, 'base64'), format: 'png' };

/** Images déjà lues, gardées tant que la fonction reste chaude (les URL changent avec le fichier). */
const imageCache = new Map<string, PdfImage | null>();

/**
 * Lit une image distante pour le PDF. react-pdf ne connaît que le JPEG et le
 * PNG : un WebP ou un SVG est ignoré (le bon s'en passe), comme une image
 * injoignable au bout de 4 s.
 */
async function fetchPdfImage(url: string): Promise<PdfImage | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;
  let img: PdfImage | null = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = Buffer.from(await res.arrayBuffer());
      if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) img = { data, format: 'png' };
      else if (data[0] === 0xff && data[1] === 0xd8) img = { data, format: 'jpg' };
    }
  } catch (err) {
    console.warn('[caissePdf] Image du bon injoignable:', url, err instanceof Error ? err.message : err);
  }
  imageCache.set(url, img);
  return img;
}

async function loadBonImages(photoUrl: string, logoUrl: string): Promise<BonImages> {
  const [photo, logoLight] = await Promise.all([
    photoUrl ? fetchPdfImage(photoUrl) : Promise.resolve(null),
    logoUrl ? fetchPdfImage(logoUrl) : Promise.resolve(null),
  ]);
  return { photo: photo ?? BUNDLED_PHOTO, logoLight, algue: BUNDLED_ALGUE };
}

/** « emmanuelle-esthetique.ch/reservation », sans protocole. */
function bookingUrl(): string {
  try {
    const u = new URL(SITE_CONFIG.url);
    return `${u.hostname.replace(/^www\./, '')}/reservation`;
  } catch {
    return '';
  }
}
