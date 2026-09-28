/**
 * Outils communs aux générations IA exécutables en tâche de fond.
 *
 * Tout ce dossier doit rester **indépendant de Next.js** : il est importé par
 * la fonction Netlify `netlify/functions/ai-job-background.mts`, empaquetée à
 * part avec esbuild, où `next/server`, `next/cache` ou les cookies n'existent
 * pas. D'où ce lecteur de réglages, équivalent de `getSettingsServer` sans
 * `unstable_noStore` (qui tirerait les internes de Next avec lui).
 */
import { SETTINGS_DEFAULTS } from '../../constants/settings';
import { supabase } from '../supabase';
import { getSupabaseAdmin } from '../../utils/supabaseAdmin';

/**
 * Lit des réglages texte dans la table `settings`, avec les valeurs par défaut
 * du projet pour les clés absentes. Ne lève jamais.
 * Les clés d'image ne sont pas transformées (inutile pour les prompts).
 */
export async function getSettingsPlain<K extends string>(keys: K[]): Promise<Record<K, string>> {
  const defaults = SETTINGS_DEFAULTS as Record<string, string>;
  const map = new Map<string, string>();
  try {
    const db = getSupabaseAdmin() || supabase;
    const { data } = await db.from('settings').select('key, value').in('key', keys);
    for (const row of (data ?? []) as { key: string; value: string | null }[]) {
      map.set(row.key, (row.value ?? '').trim());
    }
  } catch {
    // Base injoignable : on retombe sur les valeurs par défaut.
  }
  return Object.fromEntries(
    keys.map((k) => [k, map.has(k) ? map.get(k)! : (defaults[k] ?? '')]),
  ) as Record<K, string>;
}

/**
 * Erreur d'une génération, avec le code HTTP que la route synchrone doit
 * renvoyer et d'éventuelles données à joindre à la réponse (par exemple le
 * contenu extrait lors d'un import de site).
 */
export class AiTaskError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(message: string, status = 500, extra?: Record<string, unknown>) {
    super(message);
    this.name = 'AiTaskError';
    this.status = status;
    this.extra = extra;
  }
}

/** Mode d'appel transmis à `callClaude` : `long` en tâche de fond. */
export type AiTaskMode = 'quick' | 'long';

/** Enregistre des images dans la médiathèque (`media_assets`) si elles n'y sont pas. */
export async function registerMediaAssets(images: Array<{ url: string; title: string }>) {
  const dbClient = getSupabaseAdmin() || supabase;
  for (const img of images) {
    if (!img.url || typeof img.url !== 'string' || !img.url.startsWith('http')) continue;
    try {
      const { data: existing } = await dbClient
        .from('media_assets')
        .select('id')
        .eq('url', img.url)
        .maybeSingle();

      if (!existing) {
        await dbClient.from('media_assets').insert({
          file_name: img.title || 'Photo Unsplash HD',
          url: img.url,
          alt_text: img.title || 'Photo Unsplash',
        });
      }
    } catch (e) {
      console.warn('[registerMediaAssets] Warning:', e);
    }
  }
}

/** Collecte les URL d'images d'un objet de sections (champs *image*, *url*, *src*). */
export function collectImageUrls(
  root: unknown,
  titleFor: (owner: Record<string, unknown>) => string,
): Array<{ url: string; title: string }> {
  const out: Array<{ url: string; title: string }> = [];
  const walk = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && val.startsWith('http') && (key.includes('image') || key.includes('url') || key.includes('src'))) {
        out.push({ url: val, title: titleFor(obj) });
      } else if (typeof val === 'object') {
        walk(val);
      }
    }
  };
  walk(root);
  return out;
}
