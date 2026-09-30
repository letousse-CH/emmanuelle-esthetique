import { NextResponse } from 'next/server';
import { supabase } from '../../../services/supabase';

/**
 * Réglages lisibles par le public, servis depuis notre propre domaine.
 *
 * Avant, chaque page publique interrogeait directement `xxxx.supabase.co` depuis
 * le navigateur : un hôte tiers de plus (poignée de main TLS, plus une requête
 * CORS « preflight » à cause de l'en-tête `apikey`) sur le chemin critique d'un
 * mobile en 4G. Ici, même origine — donc ni préflight ni nouvelle connexion —
 * et la réponse est mise en cache par le CDN quelques secondes.
 *
 * Même clé anonyme, donc mêmes droits qu'avant : c'est RLS qui décide de ce qui
 * est lisible. `useSettings` (hooks/useSettings.ts) est le seul appelant.
 */
export const dynamic = 'force-dynamic';

// Réglages que le navigateur d'un visiteur n'utilise jamais (charte, SEO, IA, éditorial : lus côté serveur).
// Ils faisaient l'essentiel des 47 Ko de la réponse, envoyée avec une priorité haute à chaque page.
const SERVER_ONLY_KEY = /^(style_|seo_|ai_|site_|bing_|resend_|r2_)/;
const SECRET_KEY = /token|secret|api_?key|webhook|password|passwd|private/i;

export async function GET() {
  const { data: rows, error } = await supabase.from('settings').select('key, value');
  // Jamais de jeton ni de secret : la table peut en recevoir (réseaux sociaux, webhooks) et cette
  // réponse est mise en cache par le CDN.
  const data = (rows ?? []).filter((r) => !SECRET_KEY.test(r.key) && !SERVER_ONLY_KEY.test(r.key) && (process.env.DRAFT_PREVIEW === '1' || r.key !== 'navigation_menu_draft'));
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=10' },
  });
}
