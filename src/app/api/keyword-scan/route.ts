/**
 * Scan stratégique des mots-clés.
 *
 * Deux appels parallèles de dix recommandations chacun, fusionnés — un seul
 * appel de vingt tronquait le JSON. Le modèle est celui choisi dans
 * /admin/settings → IA & Budget ; `callClaude` s'en charge. La logique vit
 * dans services/aiTasks/keywordScan.ts.
 *
 * ⚠️ Le contenu déjà publié est **envoyé au modèle** (titres + adresses). Sans
 * lui, `covered_by` — le « déjà couvert → /slug » affiché dans l'admin — ne
 * pouvait être qu'inventé : la route n'avait jamais lu le moindre article,
 * alors que l'écran annonçait qu'elle les lisait tous.
 *
 * Le positionnement de la marque n'est pas codé en dur : il est lu depuis les
 * réglages « Éditorial & Marque » de l'admin (table `settings`).
 */
import { NextResponse, NextRequest } from 'next/server';
import { hasCronSecret, isAdminRequest } from '../../../utils/apiAuth';
import { getAnthropicKey } from '../../../services/secrets';
import { runKeywordScan } from '../../../services/aiTasks/keywordScan';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  /*
    Deux portes d'entrée, comme /api/automations/run : une session admin, ou le
    secret de la tâche planifiée. Sans la seconde, l'action « Scanner les
    mots-clés » d'une automatisation — qui n'a pas de session — se heurtait
    systématiquement à un 401.
  */
  // x-cron-secret (ancien en-tête) reste accepté ; x-internal-secret et la
  // session admin passent par isAdminRequest.
  const isCron = hasCronSecret(req.headers.get('x-cron-secret'));
  if (!isCron && !(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = await getAnthropicKey();
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  try {
    // Mode rapide : les trois appels partent en parallèle et tiennent sous
    // 60 s. L'écran SEO passe par une tâche de fond (type « keyword-scan »).
    return NextResponse.json(await runKeywordScan('quick'));
  } catch (e: any) {
    console.error('[keyword-scan]', e);
    return NextResponse.json({ error: e?.message ?? 'Internal server error' }, { status: 500 });
  }
}
