/**
 * Liste des modèles sélectionnables, confrontée au catalogue **en direct** de
 * l'API Anthropic (`GET /v1/models`).
 *
 * Le catalogue local (`constants/aiModels`) porte les tarifs et les capacités —
 * l'API ne les expose pas —, l'appel distant sert à marquer les modèles encore
 * servis. Un modèle retiré par Anthropic apparaît ainsi comme indisponible dans
 * l'admin au lieu d'échouer à la première génération.
 */
import { NextResponse, NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { AI_MODELS } from '../../../../constants/aiModels';
import { getAnthropicKey } from '../../../../services/secrets';

// Le catalogue distant bouge de quelques fois par an : un cache long suffit.
const CACHE_TTL = 24 * 60 * 60 * 1000;
let cache: { ids: string[] | null; at: number } | null = null;

async function fetchLiveModelIds(apiKey: string): Promise<string[] | null> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) return cache.ids;

  try {
    const client = new Anthropic({ apiKey });
    const ids: string[] = [];
    for await (const model of client.models.list()) ids.push(model.id);
    cache = { ids, at: now };
  } catch (err) {
    console.error('[ai-models] Catalogue Anthropic injoignable :', err);
    // `null` = statut inconnu : l'admin n'affiche alors aucun badge plutôt
    // qu'un « indisponible » trompeur.
    cache = { ids: null, at: now };
  }
  return cache.ids;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = await getAnthropicKey();
  const liveIds =
    apiKey && apiKey !== 'MY_ANTHROPIC_API_KEY' ? await fetchLiveModelIds(apiKey) : null;

  return NextResponse.json({
    checked: liveIds !== null,
    models: AI_MODELS.map((m) => ({
      ...m,
      available: liveIds === null ? null : liveIds.includes(m.id),
    })),
    // Modèles servis par Anthropic mais absents du catalogue local : utile pour
    // savoir qu'une nouvelle génération est sortie.
    unknownIds:
      liveIds === null ? [] : liveIds.filter((id) => !AI_MODELS.some((m) => m.id === id)),
  });
}
