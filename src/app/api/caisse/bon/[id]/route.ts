import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import BonCadeauDocument from '../../../../../components/pdf/BonCadeauDocument';
import { getBusinessInfoServer } from '../../../../../config/site';
import { getSettingsServer } from '../../../../../services/settingsServer';
import type { GiftCard } from '../../../../../types/caisse';
import { getSupabaseAdmin } from '../../../../../utils/supabaseAdmin';

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
      .from('gift_cards')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Bon cadeau introuvable.' }, { status: 404 });

    const card = data as GiftCard;
    if (card.status === 'annule') {
      return NextResponse.json({ error: 'Ce bon a été annulé : il ne peut pas être imprimé.' }, { status: 409 });
    }

    const [business, s] = await Promise.all([
      getBusinessInfoServer(),
      getSettingsServer(['caisse_bon_mentions']),
    ]);

    const buffer = await renderToBuffer(
      BonCadeauDocument({ card, business, mentions: s.caisse_bon_mentions }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${card.code}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[caisse/bon] Génération PDF impossible:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Génération du PDF impossible.' },
      { status: 500 },
    );
  }
}
