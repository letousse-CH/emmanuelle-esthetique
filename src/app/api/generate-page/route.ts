import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { getAnthropicKey } from '../../../services/secrets';
import { isModuleEnabledServer } from '../../../config/modules';
import { generatePage } from '../../../services/aiTasks/page';
import { AiTaskError } from '../../../services/aiTasks/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

/*
  Route synchrone conservée pour compatibilité, en mode rapide (sous 60 s).
  L'éditeur de pages passe désormais par une tâche de fond
  (/api/admin/ai-jobs, type « page ») qui génère avec le modèle des réglages.
  La logique vit dans services/aiTasks/page.ts.
*/
export async function POST(req: NextRequest) {
  // 1. Authenticate with Supabase JWT
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isAuth = await validateSupabaseToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  const apiKey = await getAnthropicKey();
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée.' }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  try {
    const result = await generatePage({ prompt: body?.prompt }, 'quick');
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AiTaskError) {
      return NextResponse.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
    }
    console.error('[generate-page] unexpected error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erreur lors de la génération: ${msg}` }, { status: 500 });
  }
}
