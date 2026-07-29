import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL : undefined) || 
  // @ts-ignore
  (import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined);

const supabaseAnonKey = 
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : undefined) || 
  // @ts-ignore
  (import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ URL ou Anon Key Supabase manquant. L'application ne fonctionnera pas correctement.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

