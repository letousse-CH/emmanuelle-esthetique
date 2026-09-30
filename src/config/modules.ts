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
import { MODULE_SETTING_KEYS, toModuleFlags, type ModuleFlags, type ModuleName } from './moduleFlags';

// Types et fonctions pures : voir `./moduleFlags` (importable côté client).
export { MODULE_SETTING_KEYS, toModuleFlags };
export type { ModuleFlags, ModuleName };

export async function getModuleFlagsServer(): Promise<ModuleFlags> {
  const values = await getSettingsServer(Object.values(MODULE_SETTING_KEYS));
  return toModuleFlags(values);
}

export async function isModuleEnabledServer(name: ModuleName): Promise<boolean> {
  const flags = await getModuleFlagsServer();
  return flags[name];
}
