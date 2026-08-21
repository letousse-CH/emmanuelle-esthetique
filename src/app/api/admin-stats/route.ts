import { NextResponse, NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../utils/supabaseAdmin';


export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Non autorisé. Token manquant.' }, { status: 401 });
  }
  const { error: authError } = await supabase.auth.getUser(token);
  if (authError) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart  = new Date(now.getTime() - 6 * 86400000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    const [
      { count: todayCount },
      { count: weekCount },
      { count: monthCount },
      { count: subCount },
      { count: artCount },
      { data: rawDays },
      { data: rawPages },
    ] = await Promise.all([
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('subscribers').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('articles').select('*', { count: 'exact', head: true }).eq('published', true),
      supabase.from('page_views').select('created_at').gte('created_at', weekStart).order('created_at', { ascending: true }).limit(500),
      supabase.from('page_views').select('page').gte('created_at', monthStart).limit(2000),
    ]);

    // Agréger par jour côté serveur
    const dayCounts: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      dayCounts[key] = 0;
    }
    for (const r of rawDays ?? []) {
      const key = new Date((r as { created_at: string }).created_at)
        .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
      if (key in dayCounts) dayCounts[key]++;
    }
    const days = Object.entries(dayCounts).map(([date, count]) => ({ date, count }));

    // Top pages côté serveur
    const pageCounts: Record<string, number> = {};
    for (const r of rawPages ?? []) {
      const page = (r as { page: string }).page;
      pageCounts[page] = (pageCounts[page] ?? 0) + 1;
    }
    const topPages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return NextResponse.json({
      today: todayCount ?? 0,
      week: weekCount ?? 0,
      month: monthCount ?? 0,
      subscribers: subCount ?? 0,
      articles: artCount ?? 0,
      days,
      topPages,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      }
    });
  } catch (err) {
    console.error('[admin-stats] stats error:', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
