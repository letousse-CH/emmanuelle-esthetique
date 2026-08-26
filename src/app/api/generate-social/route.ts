/**
 * Génération interactive de contenu réseaux sociaux (Instagram carrousel,
 * LinkedIn, Facebook) à partir d'un article existant ou d'une suggestion,
 * déclenchée depuis l'admin (éditeur d'article, suggestions SEO, module
 * Réseaux Sociaux). La logique IA est partagée avec l'automatisation en
 * tâche de fond via utils/socialGeneration.
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { generateSocialContent } from '../../../utils/socialGeneration';
import { isModuleEnabledServer } from '../../../config/modules';

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  let title = '';
  let content = '';
  let intro = '';
  let keyword = '';
  try {
    const body = await req.json();
    title = String(body?.title || '').trim();
    content = String(body?.content || '').trim();
    intro = String(body?.intro || '').trim();
    keyword = String(body?.keyword || '').trim();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  try {
    const result = await generateSocialContent({ title, content, intro, keyword });
    return NextResponse.json(result);
  } catch (err: any) {
    const message = err?.message || 'Erreur lors de la génération.';
    const status = message === 'not_configured' ? 503 : message.includes('obligatoire') || message.includes('nécessaire') ? 400 : 500;
    console.error('[generate-social] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
