import { supabase } from './supabase';
import { Article } from '../types/blog';

export async function fetchAllArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) console.error('[articles] fetchAll:', error.message);
  return (data ?? []) as Article[];
}

export async function fetchPublishedArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) console.error('[articles] fetchPublished:', error.message);
  return (data ?? []) as Article[];
}

export async function fetchRecentArticles(limit: number = 3): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[articles] fetchRecent:', error.message);
  return (data ?? []) as Article[];
}



export async function deleteArticle(id: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) return { success: false, error: error.message };
  if (!data?.length) return { success: false, error: 'Permissions insuffisantes. Vérifiez les droits dans Supabase.' };
  return { success: true };
}

export async function updateArticleContent(id: string, content: string): Promise<boolean> {
  const { error } = await supabase
    .from('articles')
    .update({ content })
    .eq('id', id);
  if (error) console.error('[articles] updateContent:', error.message);
  return !error;
}
