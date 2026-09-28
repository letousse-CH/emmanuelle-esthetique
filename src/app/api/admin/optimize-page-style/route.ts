import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRequest } from '../../../../utils/apiAuth';
import { optimizePageStyle } from '../../../../services/aiTasks/pageStyle';
import { AiTaskError } from '../../../../services/aiTasks/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

/*
  Route synchrone conservée pour compatibilité, en mode rapide (sous 60 s).
  L'éditeur de pages passe désormais par une tâche de fond
  (/api/admin/ai-jobs, type « page-style »).
  La logique vit dans services/aiTasks/pageStyle.ts.
*/
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await optimizePageStyle(body, 'quick');
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AiTaskError) {
      return NextResponse.json({ error: error.message, ...(error.extra ?? {}) }, { status: error.status });
    }
    console.error('[optimize-page-style] Erreur API :', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l’optimisation par Claude.' },
      { status: 500 }
    );
  }
}
