/**
 * Partie « pure » du système de modules : types, clés de réglage et conversion.
 *
 * Séparée de `modules.ts` parce que le hook client `useModuleFlags` (Navbar,
 * Footer…) l'importe : en passant par `modules.ts`, il embarquait
 * `services/settingsServer` et donc tout le client Supabase (~215 Ko de JS)
 * dans le bundle de chaque page publique. Ne rien importer ici de serveur.
 */

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
