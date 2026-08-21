import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { proxyUrl } from '../utils/media';

import { SETTINGS_DEFAULTS, IMAGE_KEYS, SettingKey } from '../constants/settings';

export { SETTINGS_DEFAULTS, IMAGE_KEYS };
export type { SettingKey };

// Module-level cache: évite les requêtes dupliquées entre composants
export const settingsCache = new Map<string, string>();
let fetchPromise: Promise<void> | null = null;

export function fetchAllSettings(): Promise<void> {
  if (fetchPromise) return fetchPromise;
  const promise = Promise.resolve(
    supabase
      .from('settings')
      .select('key, value')
  ).then(({ data, error }) => {
    if (error) {
      console.error('[fetchAllSettings] Error fetching settings:', error.message);
      fetchPromise = null;
      throw new Error(error.message);
    }
    if (data) {
      for (const r of data as { key: string; value: string | null }[]) {
        const val = (r.value ?? '').trim();
        settingsCache.set(r.key, IMAGE_KEYS.has(r.key) && val ? proxyUrl(val) : val);
      }
    }
  }).catch((err) => {
    fetchPromise = null;
    throw err;
  });
  fetchPromise = promise;
  return promise;
}

export function useSettings(keys: SettingKey[]): Record<SettingKey, string> {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(keys.map(k => [k, settingsCache.get(k) ?? SETTINGS_DEFAULTS[k] ?? '']))
  );

  useEffect(() => {
    fetchAllSettings().then(() => {
      const updates = Object.fromEntries(
        keys.map(k => [k, settingsCache.get(k) ?? SETTINGS_DEFAULTS[k] ?? ''])
      );
      setValues(updates);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return values;
}
