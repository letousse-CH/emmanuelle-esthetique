import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../../config/modules';
import { proposeWeek } from '../../../../../services/socialWeekly';

/**
 * Plan d'une semaine (lundi « AAAA-MM-JJ »).
 *
 * POST { week, action: 'propose' | 'replace', instruction? }
 *   propose : sujets sur les créneaux libres de la semaine ;
 *   replace : retire les sujets pas encore préparés, puis propose à nouveau.
 * Les sujets sont enregistrés comme brouillons datés ; rien n'est publié.
 */
export const runtime = 'nodejs';
// Appel IA synchrone : voir src/utils/ai.ts (mode « quick »).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }
  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json({ error: 'La rédaction par l’IA est désactivée (Réglages › Modules).' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const week = typeof body?.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.week) ? body.week : null;
  if (!week) return NextResponse.json({ error: 'Semaine inconnue.' }, { status: 400 });
  try {
    const out = await proposeWeek(week, {
      replace: body?.action === 'replace',
      instruction: typeof body?.instruction === 'string' ? body.instruction.slice(0, 500) : undefined,
    });
    return NextResponse.json(out);
  } catch (err: any) {
    const message = err?.message === 'not_configured' ? 'Aucune clé IA n’est configurée (Réglages › IA & Budget).' : err?.message || 'Le plan n’a pas pu être établi.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
