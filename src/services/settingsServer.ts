import { SETTINGS_DEFAULTS, IMAGE_KEYS, SettingKey } from '../constants/settings';
import { supabase } from './supabase';
import { proxyUrl } from '../utils/media';

export async function getSettingsServer(keys: SettingKey[]): Promise<Record<SettingKey, string>> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', keys);
    
    if (error) {
      console.error('[getSettingsServer] Supabase error:', error.message);
    }
    
    const settingsMap = new Map<string, string>();
    if (data) {
      for (const r of data as { key: string; value: string }[]) {
        if (r.value) {
          settingsMap.set(r.key, IMAGE_KEYS.has(r.key) ? proxyUrl(r.value) : r.value);
        }
      }
    }
    
    return Object.fromEntries(
      keys.map(k => [k, settingsMap.get(k) ?? SETTINGS_DEFAULTS[k] ?? ''])
    ) as Record<SettingKey, string>;
  } catch (err) {
    console.error('[getSettingsServer] Error fetching settings:', err);
    return Object.fromEntries(
      keys.map(k => [k, SETTINGS_DEFAULTS[k] ?? ''])
    ) as Record<SettingKey, string>;
  }
}
