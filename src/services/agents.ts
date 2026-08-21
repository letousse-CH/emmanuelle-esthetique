import { supabase } from './supabase';
import type {
  Agent,
  AgentConversation,
  AgentDocument,
  AgentMessage,
} from '../types/agents';

export async function fetchAgents(): Promise<Agent[]> {
  const [{ data, error }, avatarRes] = await Promise.all([
    supabase.from('agents').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('value').eq('key', 'agent_avatar').maybeSingle(),
  ]);
  if (error) console.error('[agents] fetchAgents:', error.message);
  const avatar = avatarRes.data?.value || '🤖';
  return (data ?? []).map((a) => ({ ...a, avatar })) as Agent[];
}

/**
 * Agent exposé au public : le premier agent actif, tel que le voit un visiteur
 * anonyme (policy `public_read_enabled`). Sert au widget de conversation du
 * site — l'admin, lui, passe par `fetchAgents`.
 */
export async function fetchPublicAgent(): Promise<Agent | null> {
  const [{ data: superAgentData, error: superErr }, avatarRes] = await Promise.all([
    supabase
      .from('agents')
      .select('id, name, slug, greeting, enabled')
      .eq('slug', 'super-agent')
      .eq('enabled', true)
      .maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'agent_avatar').maybeSingle(),
  ]);

  const avatar = avatarRes.data?.value || '🤖';

  if (!superErr && superAgentData) {
    return { ...(superAgentData as Agent), avatar };
  }

  // Fallback si super-agent n'est pas encore créé
  const { data: fallbackData } = await supabase
    .from('agents')
    .select('id, name, slug, greeting, enabled')
    .eq('enabled', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fallbackData) return null;
  return { ...(fallbackData as Agent), avatar };
}

export async function saveAgent(
  agent: Partial<Agent> & { name: string; slug: string },
): Promise<{ success: boolean; error?: string; id?: string }> {
  const { avatar, ...dbAgent } = agent;

  if (avatar) {
    await supabase.from('settings').upsert({ key: 'agent_avatar', value: avatar }, { onConflict: 'key' });
  }

  const { data, error } = await supabase
    .from('agents')
    .upsert({ ...dbAgent, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id as string };
}

export async function deleteAgent(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('agents').delete().eq('id', id);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function fetchAgentDocuments(agentId: string): Promise<AgentDocument[]> {
  try {
    const res = await fetch(`/api/admin/agents-knowledge?agentId=${encodeURIComponent(agentId)}`, { cache: 'no-store' });
    if (res.ok) {
      const payload = await res.json();
      if (Array.isArray(payload.documents)) return payload.documents as AgentDocument[];
    }
  } catch (err) {
    console.error('[agents] fetchAgentDocuments API error:', err);
  }

  // Fallback direct Supabase
  const { data, error } = await supabase
    .from('agent_documents')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (error) console.error('[agents] fetchAgentDocuments fallback:', error.message);
  return (data ?? []) as AgentDocument[];
}

export async function saveAgentDocument(
  doc: Partial<AgentDocument> & { agent_id: string; title: string; content: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/agents-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        agentId: doc.agent_id,
        title: doc.title,
        content: doc.content,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.success) return { success: true };
    if (payload?.error) return { success: false, error: payload.error };
  } catch (err) {
    console.error('[agents] saveAgentDocument API error:', err);
  }

  // Fallback Supabase
  const { error } = await supabase
    .from('agent_documents')
    .upsert(
      { source_type: 'texte', ...doc, updated_at: new Date().toISOString() },
      { onConflict: 'agent_id,source_type,source_ref' },
    );
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteAgentDocument(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/agents-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', docId: id }),
    });
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.success) return { success: true };
  } catch (err) {
    console.error('[agents] deleteAgentDocument API error:', err);
  }

  const { error } = await supabase.from('agent_documents').delete().eq('id', id);
  return error ? { success: false, error: error.message } : { success: true };
}

/**
 * Réindexe le Brief Éditorial & Marque, les pages et les articles publiés dans la
 * base de connaissances d'un agent.
 */
export async function reindexAgentKnowledge(
  agentId: string,
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const res = await fetch('/api/admin/agents-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reindex', agentId }),
    });
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.success) {
      return { success: true, count: payload.count ?? 0 };
    }
    if (payload?.error) {
      return { success: false, count: 0, error: payload.error };
    }
  } catch (err) {
    console.error('[agents] reindexAgentKnowledge API error:', err);
  }

  // Fallback direct
  return { success: false, count: 0, error: 'Réindexation échouée via l’API serveur.' };
}

export async function ensureSuperAgent(): Promise<Agent> {
  const agents = await fetchAgents();
  if (agents.length > 0) {
    const existing = agents.find((a) => a.slug === 'super-agent') || agents[0];
    if (!existing.enabled) {
      await saveAgent({ ...existing, enabled: true });
    }
    return existing;
  }

  const res = await saveAgent({
    name: 'Super Agent du Site',
    slug: 'super-agent',
    role: 'qualification',
    greeting: 'Bonjour ! Je suis l’assistant IA du site. Comment puis-je vous aider aujourd’hui ?',
    system_prompt:
      "Tu es le Super Agent IA unique du site. Tu réponds aux visiteurs avec politesse, clarté et sans jargon. Tu utilises la base de connaissances pour répondre aux questions, présenter l'entreprise, donner des estimations de tarifs et aider à la prise de rendez-vous. Récupère le nom, l'email et le besoin du visiteur au fil de la conversation.",
    collect_fields: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'email', label: 'E-mail', required: true },
      { key: 'telephone', label: 'Téléphone', required: false },
      { key: 'demande', label: 'Besoin / Demande', required: true },
    ],
    enabled: true,
  });

  const rows = await fetchAgents();
  const created = rows.find((a) => a.id === res.id) || rows[0];
  if (created) {
    await reindexAgentKnowledge(created.id);
  }
  return created;
}

export interface EditorialBriefSettings {
  site_activity_context: string;
  site_target_persona: string;
  site_tone_of_voice: string;
  site_brand_tone: string;
  site_blog_topics: string;
  site_address_mode?: 'vouvoiement' | 'tutoiement';
}

export async function fetchEditorialSettings(): Promise<EditorialBriefSettings> {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'site_activity_context',
      'site_target_persona',
      'site_tone_of_voice',
      'site_brand_tone',
      'site_blog_topics',
      'site_address_mode',
    ]);

  const map: Record<string, string> = {};
  (data ?? []).forEach((row: { key: string; value: string | null }) => {
    if (row.value) map[row.key] = row.value;
  });

  return {
    site_activity_context: map.site_activity_context ?? '',
    site_target_persona: map.site_target_persona ?? '',
    site_tone_of_voice: map.site_tone_of_voice ?? '',
    site_brand_tone: map.site_brand_tone ?? '',
    site_blog_topics: map.site_blog_topics ?? '',
    site_address_mode: (map.site_address_mode as 'vouvoiement' | 'tutoiement') || 'vouvoiement',
  };
}

export async function saveEditorialSettings(
  brief: EditorialBriefSettings,
): Promise<{ success: boolean; error?: string }> {
  const rows = [
    { key: 'site_activity_context', value: brief.site_activity_context.trim() },
    { key: 'site_target_persona', value: brief.site_target_persona.trim() },
    { key: 'site_tone_of_voice', value: brief.site_tone_of_voice.trim() },
    { key: 'site_brand_tone', value: brief.site_brand_tone.trim() },
    { key: 'site_blog_topics', value: brief.site_blog_topics.trim() },
    { key: 'site_address_mode', value: brief.site_address_mode || 'vouvoiement' },
  ];

  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  return error ? { success: false, error: error.message } : { success: true };
}

/**
 * Réduit un contenu (HTML ou blocs JSON du page builder) à du texte brut.
 * L'agent n'a pas besoin du balisage, et le transmettre gaspillerait du budget.
 */
function stripToText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') {
    return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }
  if (Array.isArray(content)) {
    return content.map(stripToText).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (typeof content === 'object') {
    const keysToSkip = new Set(['theme', 'id', 'type', 'image_url', 'image_alt', 'cta_primary_href', 'cta_secondary_href', 'image_opacity']);
    const parts: string[] = [];
    for (const [key, val] of Object.entries(content as Record<string, unknown>)) {
      if (keysToSkip.has(key)) continue;
      const text = stripToText(val);
      if (text) parts.push(text);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

export async function fetchConversations(agentId?: string): Promise<AgentConversation[]> {
  let query = supabase
    .from('agent_conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (agentId) query = query.eq('agent_id', agentId);
  const { data, error } = await query;
  if (error) console.error('[agents] fetchConversations:', error.message);
  return (data ?? []) as AgentConversation[];
}

export async function fetchMessages(conversationId: string): Promise<AgentMessage[]> {
  const { data, error } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) console.error('[agents] fetchMessages:', error.message);
  return (data ?? []) as AgentMessage[];
}
