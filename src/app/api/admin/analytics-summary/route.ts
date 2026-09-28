import { NextResponse, NextRequest } from 'next/server';
import { fetchAnalyticsSummary } from '../../../../services/analytics';
import { validateSupabaseToken } from '../../../../utils/apiAuth';

export async function GET(req: NextRequest) {
  // Statistiques réservées à l'administration : jeton de session obligatoire.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session non valide, reconnectez-vous.' }, { status: 401 });
  }
  try {
    const summary = await fetchAnalyticsSummary();
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur d’agrégation' }, { status: 500 });
  }
}
