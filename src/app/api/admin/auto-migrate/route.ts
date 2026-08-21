import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { supabase as publicSupabase } from '../../../../services/supabase';

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!await validateSupabaseToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = getSupabaseAdmin() || publicSupabase;

  const logs: string[] = [];

  try {
    // 1. Vérification & création de colonnes sur seo_clusters via rpc exec si disponible,
    // ou vérification de la présence des colonnes.
    const { data: testCluster, error: testErr } = await adminClient
      .from('seo_clusters')
      .select('id, funnel_level, ai_prompts, community_questions, geo_citation_tips, rel_bridge')
      .limit(1);

    if (testErr) {
      logs.push(`Mise à jour requise : ${testErr.message}`);
      // Tentative d'exécution d'ALTER TABLE via RPC si la fonction exec_sql existe
      const sqlQuery = `
        ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS funnel_level text DEFAULT 'découverte';
        ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS ai_prompts text[] DEFAULT '{}';
        ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS community_questions text[] DEFAULT '{}';
        ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS geo_citation_tips text[] DEFAULT '{}';
        ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS rel_bridge text DEFAULT '';
        ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS ai_prompts text[] DEFAULT '{}';
        ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS rel_bridge text DEFAULT '';
      `;

      const { error: rpcErr } = await adminClient.rpc('exec_sql', { sql: sqlQuery });
      if (rpcErr) {
        logs.push(`Note : L'exécution directe SQL RPC nécessite la fonction exec_sql sur Supabase. Si l'erreur persiste, exécutez une seule fois 'supabase/migrations/20260821_sio_geo_update.sql'.`);
      } else {
        logs.push(`✓ Colonnes SIO/GEO créées avec succès en base de données.`);
      }
    } else {
      logs.push(`✓ La table seo_clusters possède déjà toutes les colonnes SIO/GEO (funnel_level, ai_prompts, etc.).`);
    }

    // 2. Vérification des colonnes social_posts
    const { error: socialErr } = await adminClient
      .from('social_posts')
      .select('id, ai_prompts, rel_bridge')
      .limit(1);

    if (socialErr) {
      logs.push(`Vérification social_posts : ${socialErr.message}`);
    } else {
      logs.push(`✓ La table social_posts est 100% à jour.`);
    }

    return NextResponse.json({
      success: true,
      message: 'Vérification de la base de données terminée.',
      logs,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Erreur lors de l\'auto-migration',
      logs,
    }, { status: 500 });
  }
}
