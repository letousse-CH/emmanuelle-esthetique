import { NextRequest, NextResponse } from 'next/server';
import { PdfError, renderFacturePdf } from '../../../../../services/caissePdf';
import { getSupabaseAdmin } from '../../../../../utils/supabaseAdmin';
import { isAdminEmail } from '../../../../../utils/apiAuth';

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
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user || !isAdminEmail(authData.user.email)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { buffer, filename } = await renderFacturePdf(supabase, id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Une quittance ne doit jamais être servie depuis un cache partagé :
        // elle contient le nom de la cliente.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof PdfError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[caisse/facture] Génération PDF impossible:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Génération du PDF impossible.' },
      { status: 500 },
    );
  }
}
