/**
 * Reconstruction d'une page à partir d'un site existant.
 *
 * Route synchrone en mode rapide (sous 60 s) : son appelant, le panneau
 * d'import du constructeur (components/pagebuilder/SiteImportPanel), attend la
 * réponse directement. L'import complet est aussi disponible en tâche de fond
 * (/api/admin/ai-jobs, type « import-site »), à brancher dans ce panneau.
 * La logique (récupération, extraction, cartographie) vit dans
 * services/aiTasks/importSite.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { validateSupabaseToken } from '../../../utils/apiAuth';
import { fetchAndExtractSite, mapSiteToSections } from '../../../services/aiTasks/importSite';
import { AiTaskError } from '../../../services/aiTasks/shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawUrl = String(body?.url ?? '').trim();
  const mode = body?.mode === 'extract' ? 'extract' : 'full';

  try {
    // ── 1 & 2. Récupération puis extraction ────────────────────────────────
    const site = await fetchAndExtractSite(rawUrl);

    if (mode === 'extract') {
      return NextResponse.json({ extracted: site });
    }

    // ── 3. Cartographie vers les sections ──────────────────────────────────
    return NextResponse.json(await mapSiteToSections(site, 'quick'));
  } catch (error) {
    if (error instanceof AiTaskError) {
      return NextResponse.json({ error: error.message, ...(error.extra ?? {}) }, { status: error.status });
    }
    console.error('[import-site]', error);
    return NextResponse.json({ error: 'La reconstruction a échoué.' }, { status: 502 });
  }
}
