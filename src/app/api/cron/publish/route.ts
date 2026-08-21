/**
 * Publication des articles programmés — point d'entrée planifié.
 *
 * La logique vit dans `services/publishScheduled`, partagée avec l'action
 * d'automatisation du même nom.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { isModuleEnabledServer } from '../../../../config/modules';
import { publishScheduledArticles } from '../../../../services/publishScheduled';
import { emitAutomationEvent } from '../../../../services/automationRunner';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/publish] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const urlSecret = req.nextUrl.searchParams.get('secret');
  if (token !== cronSecret && urlSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('blog'))) {
    return NextResponse.json({ message: 'Module Blog désactivé, rien à publier' });
  }

  try {
    const summary = await publishScheduledArticles();
    if (summary.published.length > 0) {
      await emitAutomationEvent('article.published', req.nextUrl.origin);
    }
    return NextResponse.json({
      message: `${summary.published.length} article(s) publié(s)`,
      ...summary,
    });
  } catch (err: any) {
    console.error('[cron/publish]', err);
    return NextResponse.json({ error: err?.message || 'Erreur.' }, { status: 500 });
  }
}
