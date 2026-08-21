/**
 * Système de modules activables/désactivables : Pages (socle, toujours actif),
 * Articles, Rédaction IA, Mots-clés, Réseaux, Newsletter, Caisse, Agents IA,
 * Automatisations. Les flags sont stockés dans la table Supabase `settings` comme
 * n'importe quel autre réglage, pour réutiliser la plomberie RLS/admin existante.
 *
 * Ce fichier ne doit importer que des dépendances "server-safe" (pas de hooks
 * React) : il est importé directement par des Server Components (pages, route
 * handlers). Le hook client `useModuleFlags` vit dans `../hooks/useModuleFlags`.
 */
import { getSettingsServer } from '../services/settingsServer';

export type ModuleName =
  | 'blog'
  | 'ai_generation'
  | 'events'
  | 'keywords'
  | 'newsletter'
  | 'social'
  | 'caisse'
  | 'agents'
  | 'automations'
  | 'decodeur';

export const MODULE_SETTING_KEYS = {
  blog: 'module_blog_enabled',
  ai_generation: 'module_ai_generation_enabled',
  events: 'module_events_enabled',
  newsletter: 'module_newsletter_enabled',
  social: 'module_social_enabled',
  caisse: 'module_caisse_enabled',
  keywords: 'module_keywords_enabled',
  agents: 'module_agents_enabled',
  automations: 'module_automations_enabled',
  decodeur: 'module_decodeur_enabled',
} as const;

export type ModuleFlags = Record<ModuleName, boolean>;

export function toModuleFlags(values: Record<string, string>): ModuleFlags {
  return {
    blog: values[MODULE_SETTING_KEYS.blog] !== 'false',
    ai_generation: values[MODULE_SETTING_KEYS.ai_generation] !== 'false',
    events: values[MODULE_SETTING_KEYS.events] !== 'false',
    newsletter: values[MODULE_SETTING_KEYS.newsletter] !== 'false',
    social: values[MODULE_SETTING_KEYS.social] !== 'false',
    caisse: values[MODULE_SETTING_KEYS.caisse] !== 'false',
    keywords: values[MODULE_SETTING_KEYS.keywords] !== 'false',
    agents: values[MODULE_SETTING_KEYS.agents] !== 'false',
    automations: values[MODULE_SETTING_KEYS.automations] !== 'false',
    decodeur: values[MODULE_SETTING_KEYS.decodeur] !== 'false',
  };
}

export async function getModuleFlagsServer(): Promise<ModuleFlags> {
  const values = await getSettingsServer(Object.values(MODULE_SETTING_KEYS));
  return toModuleFlags(values);
}

export async function isModuleEnabledServer(name: ModuleName): Promise<boolean> {
  const flags = await getModuleFlagsServer();
  return flags[name];
}
