import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import {
  choosePage,
  disconnectMeta,
  getMetaStatus,
  listChoosablePages,
  saveMetaApp,
} from '../../../../../services/metaConnection';
import { publicOrigin } from '../../../../../utils/publicOrigin';

/**
 * État de la connexion Facebook + Instagram, et ses réglages.
 *
 * GET   : état vérifié en direct auprès de Meta + adresse de retour OAuth à
 *         déclarer dans l'application Meta.
 * POST  : { action: 'save_app', appId, appSecret?, configId? }
 *         { action: 'list_pages' } · { action: 'choose_page', pageId }
 *         { action: 'disconnect' }
 * Aucun jeton ne redescend jamais vers le navigateur.
 */
export const runtime = 'nodejs';

async function denied(req: NextRequest) {
  return !(await validateSupabaseToken(getBearerToken(req)));
}

export async function GET(req: NextRequest) {
  if (await denied(req)) return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  try {
    const status = await getMetaStatus();
    return NextResponse.json({ ...status, redirectUri: `${publicOrigin(req)}/api/admin/meta/callback` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'État indisponible.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (await denied(req)) return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    switch (body?.action) {
      case 'save_app': {
        const { name } = await saveMetaApp({
          appId: String(body.appId || ''),
          appSecret: String(body.appSecret || ''),
          configId: String(body.configId || ''),
        });
        return NextResponse.json({ ok: true, appName: name });
      }
      case 'list_pages':
        return NextResponse.json({ pages: await listChoosablePages() });
      case 'choose_page': {
        const page = await choosePage(String(body.pageId || ''));
        return NextResponse.json({ ok: true, page: { id: page.id, name: page.name }, instagram: page.instagram });
      }
      case 'disconnect':
        await disconnectMeta();
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Action impossible.' }, { status: 400 });
  }
}
