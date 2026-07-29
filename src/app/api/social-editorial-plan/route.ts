/**
 * Propose un plan éditorial réseaux sociaux (sujets datés) à partir de la ligne
 * éditoriale de la marque. Ne rédige aucun contenu : l'admin fait ensuite
 * générer les posts sujet par sujet via /api/generate-social.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../config/modules';
import { generateEditorialPlan, type EditorialPeriod } from '../../../utils/editorialPlan';

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('social'))) {
    return NextResponse.json({ error: 'Module Réseaux Sociaux désactivé' }, { status: 403 });
  }

  let period: EditorialPeriod = 'week';
  let dates: string[] = [];
  let existingTitles: string[] = [];
  try {
    const body = await req.json();
    period = body?.period === 'month' ? 'month' : 'week';
    dates = Array.isArray(body?.dates) ? body.dates.map((d: unknown) => String(d)) : [];
    existingTitles = Array.isArray(body?.existingTitles) ? body.existingTitles.map((t: unknown) => String(t)) : [];
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  if (dates.length === 0) {
    return NextResponse.json({ error: 'Aucune date de publication fournie.' }, { status: 400 });
  }

  try {
    const topics = await generateEditorialPlan({ period, dates, existingTitles });
    return NextResponse.json({ topics });
  } catch (err: any) {
    const message = err?.message || 'Erreur lors de la génération du plan.';
    const status = message === 'not_configured' ? 503 : 500;
    console.error('[social-editorial-plan] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
