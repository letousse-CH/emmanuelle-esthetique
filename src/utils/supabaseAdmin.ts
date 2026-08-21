import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase à privilèges de service, réservé aux routes serveur.
 *
 * Il contourne la sécurité au niveau des lignes : ne jamais l'importer depuis
 * un composant client. Les routes publiques (widget d'agent) en ont besoin
 * pour écrire des conversations sans exposer de session utilisateur.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
