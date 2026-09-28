import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../config/modules';
import { runBlocksAi, type BlocksAiInput } from '../../../../services/aiTasks/blocks';
import { AiTaskError } from '../../../../services/aiTasks/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * IA du page builder v2 — route synchrone, en mode rapide (sous 60 s).
 * Le mode « page » (réécriture de la page entière) est aussi disponible en
 * tâche de fond (/api/admin/ai-jobs, type « blocks-ai ») : c'est le chemin à
 * utiliser depuis l'éditeur, la page entière dépassant souvent 60 s.
 * La logique vit dans services/aiTasks/blocks.ts.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }
  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json({ error: "Le module « Génération IA » est désactivé dans les réglages." }, { status: 403 });
  }

  let body: BlocksAiInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  try {
    return NextResponse.json(await runBlocksAi(body, 'quick'));
  } catch (err) {
    if (err instanceof AiTaskError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[blocks-ai]', err);
    return NextResponse.json({ error: `Erreur IA : ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
