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
import BonCadeauDocument from '../components/pdf/BonCadeauDocument';
import { getBusinessInfoServer } from '../config/site';
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
    getSettingsServer(['caisse_bon_mentions']),
  ]);

  const buffer = await renderToBuffer(
    BonCadeauDocument({ card, business, mentions: s.caisse_bon_mentions }),
  );

  return { buffer, filename: `${card.code}.pdf` };
}
