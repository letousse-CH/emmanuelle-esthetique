import { cache } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { SETTINGS_DEFAULTS, IMAGE_KEYS, SettingKey } from '../constants/settings';
import { supabase } from './supabase';
import { proxyUrl } from '../utils/media';
import { DESIGN_TOKEN_KEYS, DESIGN_TOKEN_DEFAULTS } from '../constants/designTokens';
import { DRAFT_PREVIEW } from './draftPreview';

/**
 * Pas de `noStore()` en production : il rendait dynamique (SSR à chaque requête)
 * toute page qui lisait un réglage. Les pages publiques sont désormais en ISR
 * (`revalidate`) : les réglages sont lus au rendu, puis figés dans le HTML mis
 * en cache jusqu'à la prochaine revalidation. Seul l'aperçu local des brouillons
 * (`DRAFT_PREVIEW`) reste sans cache, pour suivre les changements de menu.
 */
function noCacheInDraftPreview() {
  if (DRAFT_PREVIEW) noStore();
}

/**
 * Lecture dédoublonnée pour la durée d'un rendu : le layout racine, le layout
 * public, les métadonnées et la page redemandent souvent les mêmes clés. La clé
 * de cache est une chaîne (les tableaux seraient comparés par identité).
 */
const fetchSettingRows = cache(async (keysCsv: string) => {
  const { data } = await supabase.from('settings').select('key, value').in('key', keysCsv.split(','));
  return (data ?? []) as { key: string; value: string | null }[];
});

export async function getSettingsServer(keys: SettingKey[]): Promise<Record<SettingKey, string>> {
  noCacheInDraftPreview();
  try {
    const data = await fetchSettingRows([...new Set(keys)].sort().join(','));

    const settingsMap = new Map<string, string>();
    for (const r of data) {
      const val = (r.value ?? '').trim();
      settingsMap.set(r.key, IMAGE_KEYS.has(r.key) && val ? proxyUrl(val) : val);
    }
    
    return Object.fromEntries(
      keys.map(k => [k, settingsMap.has(k) ? settingsMap.get(k)! : (SETTINGS_DEFAULTS[k] ?? '')])
    ) as Record<SettingKey, string>;
  } catch (err) {
    // Silencieusement ignoré si la connexion Supabase échoue
    return Object.fromEntries(
      keys.map(k => [k, SETTINGS_DEFAULTS[k] ?? ''])
    ) as Record<SettingKey, string>;
  }
}

export async function getEditorialSettings(): Promise<Record<string, string>> {
  const keys: SettingKey[] = [
    'site_activity_context',
    'site_target_persona',
    'site_tone_of_voice',
    'site_brand_tone',
    'site_blog_topics',
  ];
  return getSettingsServer(keys);
}

/**
 * Jetons « Design & Style » (couleurs, polices, échelle typographique, boutons).
 * Lus côté serveur pour que la charte soit déjà dans le HTML : appliquée après
 * l'hydratation, elle faisait sauter toute la page (polices, tailles, marges).
 * Même fusion que le client : la valeur enregistrée l'emporte, y compris vide.
 */
export async function getDesignTokensServer(): Promise<Record<string, string>> {
  noCacheInDraftPreview();
  const map: Record<string, string> = { ...DESIGN_TOKEN_DEFAULTS };
  try {
    const { data } = await supabase.from('settings').select('key, value').in('key', DESIGN_TOKEN_KEYS);
    for (const row of (data ?? []) as { key: string; value: string | null }[]) {
      if (row.key in map) map[row.key] = (row.value ?? '').trim();
    }
  } catch {
    // Base injoignable : repli sur les valeurs par défaut.
  }
  return map;
}
