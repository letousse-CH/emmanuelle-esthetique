import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import FactureDocument from '../../../../../components/pdf/FactureDocument';
import { getBusinessInfoServer } from '../../../../../config/site';
import { getSettingsServer } from '../../../../../services/settingsServer';
import type { TransactionWithItems } from '../../../../../types/caisse';
import { getSupabaseAdmin } from '../../../../../utils/supabaseAdmin';

// `@react-pdf/renderer` s'appuie sur des API Node : la route ne peut pas tourner
// sur le runtime Edge de Netlify.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Non autorisé. Token manquant.' }, { status: 401 });
  }
  const { error: authError } = await supabase.auth.getUser(token);
  if (authError) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, transaction_items(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
    }

    const transaction = data as TransactionWithItems;
    transaction.transaction_items = [...(transaction.transaction_items ?? [])]
      .sort((a, b) => a.ordre - b.ordre);

    const [business, s, emisRes, utiliseRes] = await Promise.all([
      getBusinessInfoServer(),
      getSettingsServer([
        'caisse_tva_assujetti',
        'caisse_tva_numero',
        'caisse_iban',
        'caisse_facture_mentions',
      ]),
      // Bons vendus par cette facture : leur code doit y figurer, c'est la
      // preuve remise à l'acheteuse.
      supabase
        .from('gift_cards')
        .select('code, libelle, montant_initial, expire_le')
        .eq('sale_transaction_id', id)
        .order('number_seq', { ascending: true }),
      // Bon présenté en paiement, s'il y en a un.
      transaction.gift_card_id
        ? supabase
            .from('gift_cards')
            .select('code, montant_restant')
            .eq('id', transaction.gift_card_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

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
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${transaction.numero}.pdf"`,
        // Une quittance ne doit jamais être servie depuis un cache partagé :
        // elle contient le nom de la cliente.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[caisse/facture] Génération PDF impossible:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Génération du PDF impossible.' },
      { status: 500 },
    );
  }
}
