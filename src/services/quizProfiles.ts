import { supabase } from './supabase';

export interface QuizProfileRow {
  id: string;
  tag: string;
  zone: string;
  min_score: number;
  max_score: number;
  title: string;
  tagline: string;
  body: string;
  cta_type: 'soft' | 'strong';
  cta_label: string;
  cta_href: string;
}

export interface QuizProfile {
  id: string;
  tag: string;
  zone: string;
  minScore: number;
  maxScore: number;
  title: string;
  tagline: string;
  body: string[];
  ctaType: 'soft' | 'strong';
  ctaLabel: string;
  ctaHref: string;
}

function mapRow(row: QuizProfileRow): QuizProfile {
  return {
    id: row.id,
    tag: row.tag,
    zone: row.zone,
    minScore: row.min_score,
    maxScore: row.max_score,
    title: row.title,
    tagline: row.tagline,
    body: row.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
    ctaType: row.cta_type,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
  };
}

/** Profils du Décodeur de Relations, éditables depuis /admin/decodeur. */
export async function fetchQuizProfiles(): Promise<QuizProfile[]> {
  const { data, error } = await supabase
    .from('quiz_profiles')
    .select('*')
    .order('min_score', { ascending: true });
  if (error) {
    console.warn('[quizProfiles] fetch:', error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function updateQuizProfile(id: string, fields: Partial<QuizProfileRow>) {
  const { error } = await supabase.from('quiz_profiles').update(fields).eq('id', id);
  return { error };
}
