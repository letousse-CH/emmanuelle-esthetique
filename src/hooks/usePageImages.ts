import { useSettings, SETTINGS_DEFAULTS } from './useSettings';

// Re-exported for backwards compatibility with admin/PageImages.tsx
export const PAGE_IMAGE_DEFAULTS = SETTINGS_DEFAULTS;

export function usePageImages(keys: string[]): Record<string, string> {
  return useSettings(keys);
}
