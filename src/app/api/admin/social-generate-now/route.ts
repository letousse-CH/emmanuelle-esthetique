/**
 * Déclenchement manuel de l'automatisation réseaux sociaux depuis l'admin
 * (bouton "Générer maintenant" dans /admin/social) — même logique que le
 * cron, mais authentifiée par session admin plutôt que par CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../config/modules';
import { runSocialAutomation } from '../../../../services/socialAutomation';

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('social'))) {
    return NextResponse.json({ error: 'Module Réseaux Sociaux désactivé' }, { status: 403 });
  }

  try {
    const summary = await runSocialAutomation(3);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[social-generate-now] error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur lors de la génération.' }, { status: 500 });
  }
}
