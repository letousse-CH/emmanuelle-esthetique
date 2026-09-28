import { supabase } from './supabase';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { DRAFT_PREVIEW, draftSlug } from './draftPreview';
import type { PageSection } from '../components/pagebuilder/wireframes.config';

export interface DynamicPage {
  id: string;
  title: string;
  slug: string;
  sections: PageSection[];
  /** Page builder v2 (sections > colonnes > blocs). Voir components/blocks. */
  content?: unknown;
  content_version?: number;
  published: boolean;
  show_header: boolean;
  show_footer: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchAllPages(): Promise<DynamicPage[]> {
  const { data, error } = await supabase
    .from('dynamic_pages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as DynamicPage[];
}

export async function fetchPageBySlug(slug: string, adminMode = false): Promise<DynamicPage | null> {
  // Aperçu local des brouillons : la clé anonyme ne lit pas les pages non publiées.
  if (DRAFT_PREVIEW && typeof window === 'undefined') {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data } = await admin.from('dynamic_pages').select('*').eq('slug', draftSlug(slug)).maybeSingle();
      if (data) return data as DynamicPage;
    }
  }
  let query = supabase.from('dynamic_pages').select('*').eq('slug', slug);
  if (!adminMode) query = query.eq('published', true);
  const { data, error } = await query.single();
  if (error) return null;
  return data as DynamicPage;
}

export async function fetchPageById(id: string): Promise<DynamicPage | null> {
  const { data, error } = await supabase
    .from('dynamic_pages')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as DynamicPage;
}

export async function savePage(page: Omit<DynamicPage, 'id' | 'created_at' | 'updated_at'>): Promise<DynamicPage> {
  const { data, error } = await supabase
    .from('dynamic_pages')
    .insert(page)
    .select()
    .single();
  if (error) throw error;
  return data as DynamicPage;
}

export async function updatePage(id: string, patch: Partial<Omit<DynamicPage, 'id' | 'created_at' | 'updated_at'>>): Promise<DynamicPage> {
  const { data, error } = await supabase
    .from('dynamic_pages')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as DynamicPage;
}

export async function deletePage(id: string): Promise<void> {
  const { error } = await supabase.from('dynamic_pages').delete().eq('id', id);
  if (error) throw error;
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
