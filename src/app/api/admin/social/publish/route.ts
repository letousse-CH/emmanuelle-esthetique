import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import {
  advancePost,
  loadSnapshot,
  PublishRefused,
  retryNetwork,
  schedulePost,
  startPublishing,
  unschedulePost,
} from '../../../../../services/socialPublish';

/**
 * Publier, programmer, suivre un envoi.
 *
 * POST { postId, action } :
 *   'now'        publier tout de suite (contrôles, puis envoi)
 *   'schedule'   programmer à `scheduledAt` (ISO)
 *   'unschedule' revenir au brouillon
 *   'advance'    faire avancer un envoi en cours (Instagram traite l'image)
 *   'retry'      relancer `network` après un échec
 *   'status'     relire l'état
 *
 * La réponse rend la main en 25 s au plus (une fonction Netlify en a 60) ;
 * `post.status === 'publishing'` veut dire « rappelez 'advance' dans quelques
 * secondes » — Instagram n'a pas fini de traiter l'image, ou la base a ralenti.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const BUDGET_MS = 25_000;

export async function POST(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }
  const deadline = Date.now() + BUDGET_MS;
  const body = await req.json().catch(() => ({}));
  const postId = String(body?.postId || '');
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return NextResponse.json({ error: 'Publication inconnue.' }, { status: 400 });

  try {
    switch (body?.action) {
      case 'now':
        return NextResponse.json(await startPublishing(postId, deadline));
      case 'schedule':
        return NextResponse.json(await schedulePost(postId, new Date(String(body.scheduledAt || ''))));
      case 'unschedule':
        return NextResponse.json(await unschedulePost(postId));
      case 'advance':
        return NextResponse.json(await advancePost(postId, deadline));
      case 'retry': {
        const network = body.network === 'instagram' ? 'instagram' : body.network === 'facebook' ? 'facebook' : null;
        if (!network) return NextResponse.json({ error: 'Réseau inconnu.' }, { status: 400 });
        return NextResponse.json(await retryNetwork(postId, network, deadline));
      }
      case 'status':
        return NextResponse.json(await loadSnapshot(postId));
      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }
  } catch (err: any) {
    if (err instanceof PublishRefused) {
      return NextResponse.json({ error: err.message, problems: err.problems }, { status: 422 });
    }
    console.error('[social/publish]', err);
    return NextResponse.json({ error: err?.message || 'Envoi impossible.' }, { status: 500 });
  }
}
