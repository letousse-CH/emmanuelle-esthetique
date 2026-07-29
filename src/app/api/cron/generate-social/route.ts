/**
 * Automatisation planifiée du contenu réseaux sociaux — à appeler
 * périodiquement par un déclencheur externe (ce projet n'a pas de scheduler
 * intégré ; même principe que /api/cron/quiz-sequence). Détecte les
 * nouveaux articles/entrées RSS/suggestions et pré-génère du contenu prêt à
 * relire dans le calendrier admin (/admin/social).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isModuleEnabledServer } from '../../../../config/modules';
import { runSocialAutomation } from '../../../../services/socialAutomation';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[generate-social] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const urlSecret = req.nextUrl.searchParams.get('secret');
  if (token !== cronSecret && urlSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('social'))) {
    return NextResponse.json({ skipped: true, reason: 'Module Réseaux Sociaux désactivé' });
  }

  try {
    const summary = await runSocialAutomation(3);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[cron/generate-social] error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur lors de la génération.' }, { status: 500 });
  }
}
