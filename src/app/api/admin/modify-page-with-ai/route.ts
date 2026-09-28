import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRequest } from '../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../config/modules';
import { modifyPageWithAi } from '../../../../services/aiTasks/pageModify';
import { AiTaskError } from '../../../../services/aiTasks/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

/*
  Route synchrone en mode rapide (sous 60 s) : elle sert les modales de
  section du constructeur, qui ne modifient qu'une section à la fois.
  La modification d'une page entière depuis l'éditeur passe par une tâche de
  fond (/api/admin/ai-jobs, type « page-modify »).
  La logique vit dans services/aiTasks/pageModify.ts.
*/
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Session invalide ou expirée.' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const result = await modifyPageWithAi(body, 'quick');
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AiTaskError) {
      return NextResponse.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
    }
    console.error('[modify-page-with-ai] unexpected error:', err);
    return NextResponse.json({ error: `Erreur lors de la modification : ${err.message || String(err)}` }, { status: 500 });
  }
}
