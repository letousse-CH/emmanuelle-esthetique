import { unstable_noStore as noStore } from 'next/cache';
import { SETTINGS_DEFAULTS, IMAGE_KEYS, SettingKey } from '../constants/settings';
import { supabase } from './supabase';
import { proxyUrl } from '../utils/media';

export async function getSettingsServer(keys: SettingKey[]): Promise<Record<SettingKey, string>> {
  noStore();
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', keys);
    
    if (error) {
      // Silencieusement ignoré en cas de base hors-ligne ou clés fictives en dev
    }
    
    const settingsMap = new Map<string, string>();
    if (data) {
      for (const r of data as { key: string; value: string | null }[]) {
        const val = (r.value ?? '').trim();
        settingsMap.set(r.key, IMAGE_KEYS.has(r.key) && val ? proxyUrl(val) : val);
      }
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
