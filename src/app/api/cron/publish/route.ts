import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { SITE_CONFIG } from '../../../../config/site';
import { isModuleEnabledServer } from '../../../../config/modules';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[publish-scheduled] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const urlSecret = req.nextUrl.searchParams.get('secret');
  if (token !== cronSecret && urlSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[publish-scheduled] Variables Supabase manquantes');
    return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 });
  }

  if (!(await isModuleEnabledServer('blog'))) {
    return NextResponse.json({ message: 'Module Blog désactivé, rien à publier' });
  }

  const now = new Date().toISOString();

  try {
    const selectRes = await fetch(
      `${SUPABASE_URL}/rest/v1/articles?published=eq.false&scheduled_at=lte.${encodeURIComponent(now)}&scheduled_at=not.is.null&select=id,title,slug`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!selectRes.ok) {
      console.error('[publish-scheduled] Erreur SELECT', { status: selectRes.status, body: await selectRes.text() });
      return NextResponse.json({ error: 'SELECT error' }, { status: 500 });
    }

    const articles: { id: string; title: string; slug: string }[] = await selectRes.json();

    if (articles.length === 0) {
      return NextResponse.json({ message: 'Aucun article à publier' });
    }

    const published: string[] = [];
    for (const article of articles) {
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/articles?id=eq.${article.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ published: true, scheduled_at: null }),
        }
      );

      if (updateRes.ok) {
        console.log(`[publish-scheduled] Article publié: ${article.title} (${article.slug})`);
        published.push(article.slug);
        revalidatePath('/blog');
        revalidatePath(`/blog/${article.slug}`);
        try {
          await fetch(
            `https://www.bing.com/indexnow?url=${encodeURIComponent(`${SITE_CONFIG.url}/blog/${article.slug}`)}&key=${SITE_CONFIG.bingIndexNowKey}`
          );
        } catch { /* non critique */ }
      } else {
        console.error('[publish-scheduled] Erreur PATCH', { id: article.id, status: updateRes.status, body: await updateRes.text() });
      }
    }

    return NextResponse.json({ message: `${published.length} articles publiés`, published });
  } catch (err: any) {
    console.error('[publish-scheduled] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
