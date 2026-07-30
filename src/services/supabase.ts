import { createClient } from '@supabase/supabase-js';

// Les valeurs sont injectées au build par next.config.ts (clé `env`), donc
// disponibles côté serveur comme côté navigateur. Les variantes VITE_* sont
// conservées le temps que les environnements existants soient migrés.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ URL ou Anon Key Supabase manquant. L'application ne fonctionnera pas correctement.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

