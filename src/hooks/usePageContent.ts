import { useSettings, SETTINGS_DEFAULTS } from './useSettings';

// Re-exported for backwards compatibility with admin/PageContent.tsx
export const PAGE_CONTENT_DEFAULTS = SETTINGS_DEFAULTS;

export function usePageContent(keys: string[]): Record<string, string> {
  return useSettings(keys);
}
