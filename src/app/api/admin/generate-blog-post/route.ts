import { NextResponse, NextRequest } from 'next/server';
import { isAdminRequest } from '../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../config/modules';
import { generateBlogPost } from '../../../../services/aiTasks/blogPost';
import { AiTaskError } from '../../../../services/aiTasks/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Session admin ou appel interne (autopilote) : plus aucun accès anonyme.
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    // Mode rapide (sous 60 s) : l'autopilote attend la réponse directement.
    // La même rédaction existe en tâche de fond (type « blog-post »).
    return NextResponse.json(await generateBlogPost(body, 'quick'));
  } catch (err: any) {
    if (err instanceof AiTaskError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[generate-blog-post] Erreur:', err);
    return NextResponse.json({ error: `Erreur lors de la génération: ${err.message}` }, { status: 500 });
  }
}
