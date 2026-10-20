/**
 * Publications programmées — point d'entrée planifié (toutes les dix minutes,
 * `netlify/functions/cron-social-publish.mjs`). Publie ce qui est arrivé à
 * l'heure et termine les envois Instagram laissés en cours.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { hasCronSecret, getBearerToken } from '../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../config/modules';
import { runSocialPublishCron } from '../../../../services/socialPublish';

export const runtime = 'nodejs';
// La fonction planifiée qui l'appelle (cron-social-publish.mjs) a 30 s en tout.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/social-publish] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasCronSecret(getBearerToken(req)) && !hasCronSecret(req.nextUrl.searchParams.get('secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isModuleEnabledServer('social'))) {
    return NextResponse.json({ skipped: true, reason: 'Module Réseaux sociaux désactivé' });
  }
  try {
    return NextResponse.json(await runSocialPublishCron(Date.now() + 20_000));
  } catch (err: any) {
    console.error('[cron/social-publish]', err);
    return NextResponse.json({ error: err?.message || 'Erreur.' }, { status: 500 });
  }
}
