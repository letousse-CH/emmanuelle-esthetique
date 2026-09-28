import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { supabase } from '../../../../services/supabase';
import { isModuleEnabledServer } from '../../../../config/modules';
import { isAdminRequest } from '../../../../utils/apiAuth';
import { runSiteStructureAction } from '../../../../services/aiTasks/siteStructure';
import { AiTaskError } from '../../../../services/aiTasks/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

/*
  Route synchrone en mode rapide (sous 60 s) : son appelant, la fenêtre de
  création automatique du site (components/pagebuilder/AutoGenerateSiteModal),
  attend la réponse directement. Les actions IA sont aussi disponibles en
  tâche de fond (/api/admin/ai-jobs, type « site-structure »), à brancher dans
  cette fenêtre. La logique vit dans services/aiTasks/siteStructure.ts.
*/
export async function POST(req: NextRequest) {
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
    const { action } = body;

    if (action === 'update_navigation_menu') {
      const { generatedPages } = body;
      const dbClient = getSupabaseAdmin() || supabase;

      const navItems = (generatedPages || []).map((p: { title: string; slug: string }) => {
        const isHome = p.slug === 'accueil' || p.slug === 'home';
        return {
          name: p.title,
          path: isHome ? '/' : `/${p.slug}`,
        };
      });

      const menuJson = JSON.stringify(navItems);

      const { error: menuError } = await dbClient
        .from('settings')
        .upsert([{ key: 'navigation_menu', value: menuJson }], { onConflict: 'key' });

      if (menuError) {
        console.error('[generate-site-structure] Erreur sauvegarde menu :', menuError);
      }

      return NextResponse.json({
        success: true,
        menu: navItems,
      });
    }

    if (action === 'check_and_propose' || action === 'generate_single_page') {
      return NextResponse.json(await runSiteStructureAction(body, 'quick'));
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (error: any) {
    if (error instanceof AiTaskError) {
      return NextResponse.json({ error: error.message, ...(error.extra ?? {}) }, { status: error.status });
    }
    console.error('[generate-site-structure] Erreur API :', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération par Claude.' },
      { status: 500 }
    );
  }
}
