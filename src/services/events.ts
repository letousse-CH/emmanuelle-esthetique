import { supabase } from './supabase';
import { SdeEvent, EventStatus } from '../types/events';

export async function fetchAllEvents(): Promise<SdeEvent[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('date_start', { ascending: true, nullsFirst: false });
  return (data ?? []) as SdeEvent[];
}

export async function fetchUpcomingEvents(limit: number = 3): Promise<SdeEvent[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('date_start', { ascending: true, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as SdeEvent[];
}



export async function fetchEventRegistrationCount(eventIds: string[]): Promise<Record<string, number>> {
  if (!eventIds.length) return {};
  
  const { data, error } = await supabase
    .from('event_registrations')
    .select('event_id')
    .eq('payment_status', 'paid')
    .in('event_id', eventIds);
  
  if (error) {
    console.error('[fetchEventRegistrationCount] Error:', error.message);
    return {};
  }
  
  const counts: Record<string, number> = {};
  eventIds.forEach(id => { counts[id] = 0; });
  
  data?.forEach((r: any) => {
    if (r.event_id) {
      counts[r.event_id] = (counts[r.event_id] || 0) + 1;
    }
  });
  
  return counts;
}

export async function deleteEvent(id: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .select('id');
  return { success: !error && !!data?.length };
}

export async function toggleEventStatus(id: string, currentStatus: string): Promise<{ success: boolean; nextStatus: EventStatus }> {
  const nextStatus: EventStatus = currentStatus === 'published' ? 'paused' : 'published';
  const { error } = await supabase
    .from('events')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { success: !error, nextStatus };
}
