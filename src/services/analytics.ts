/**
 * Service Analytics & Suivi des Conversions Didactique (0 Jargon)
 */
import { supabase } from './supabase';

export type AnalyticsEventType = 'page_view' | 'cta_click' | 'form_submit';

export interface AnalyticsEventPayload {
  event_type: AnalyticsEventType;
  page_slug: string;
  page_title?: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsSummary {
  total_page_views: number;
  total_cta_clicks: number;
  total_form_submits: number;
  global_conversion_rate: number; // %
  top_pages: {
    slug: string;
    title: string;
    views: number;
    cta_clicks: number;
    submits: number;
    conversion_rate: number;
  }[];
  recent_events: {
    id: string;
    event_type: AnalyticsEventType;
    page_slug: string;
    metadata: any;
    created_at: string;
  }[];
}

/**
 * Enregistre un événement analytics dans Supabase avec fallback gracieux
 */
export async function trackAnalyticsEvent(payload: AnalyticsEventPayload): Promise<boolean> {
  const cleanSlug = payload.page_slug || 'home';
  const eventData = {
    event_type: payload.event_type,
    page_slug: cleanSlug,
    page_title: payload.page_title || cleanSlug,
    metadata: payload.metadata || {},
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from('analytics_events').insert(eventData);
    if (error) {
      // Fallback localstorage pour résilience si la table n'est pas encore créée
      saveLocalAnalyticsEvent(eventData);
    }
    return true;
  } catch (err) {
    saveLocalAnalyticsEvent(eventData);
    return false;
  }
}

function saveLocalAnalyticsEvent(event: any) {
  if (typeof window === 'undefined') return;
  try {
    const key = 'analytics_events_queue';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ ...event, id: 'local_' + Math.random().toString(36).slice(2) });
    localStorage.setItem(key, JSON.stringify(existing.slice(-200)));
  } catch (e) {}
}

/**
 * Récupère le récapitulatif analytics consolidé pour l'admin
 */
export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  let events: any[] = [];

  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (data && !error) {
      events = data;
    } else {
      events = getLocalAnalyticsEvents();
    }
  } catch {
    events = getLocalAnalyticsEvents();
  }

  const total_page_views = events.filter(e => e.event_type === 'page_view').length;
  const total_cta_clicks = events.filter(e => e.event_type === 'cta_click').length;
  const total_form_submits = events.filter(e => e.event_type === 'form_submit').length;

  const global_conversion_rate = total_page_views > 0
    ? Number(((total_form_submits / total_page_views) * 100).toFixed(1))
    : 0;

  // Group by page
  const pageMap: Record<string, { title: string; views: number; cta: number; submits: number }> = {};

  events.forEach(e => {
    const slug = e.page_slug || 'home';
    if (!pageMap[slug]) {
      pageMap[slug] = { title: e.page_title || slug, views: 0, cta: 0, submits: 0 };
    }
    if (e.event_type === 'page_view') pageMap[slug].views += 1;
    if (e.event_type === 'cta_click') pageMap[slug].cta += 1;
    if (e.event_type === 'form_submit') pageMap[slug].submits += 1;
  });

  const top_pages = Object.entries(pageMap).map(([slug, data]) => {
    const rate = data.views > 0 ? Number(((data.submits / data.views) * 100).toFixed(1)) : 0;
    return {
      slug,
      title: data.title,
      views: data.views,
      cta_clicks: data.cta,
      submits: data.submits,
      conversion_rate: rate,
    };
  }).sort((a, b) => b.views - a.views);

  return {
    total_page_views,
    total_cta_clicks,
    total_form_submits,
    global_conversion_rate,
    top_pages,
    recent_events: events.slice(0, 20),
  };
}

function getLocalAnalyticsEvents(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('analytics_events_queue') || '[]');
  } catch {
    return [];
  }
}
