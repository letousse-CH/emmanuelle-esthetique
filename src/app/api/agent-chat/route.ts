/**
 * Conversation avec un agent IA — point d'entrée public du widget.
 *
 * Volontairement sans authentification : c'est un visiteur anonyme qui écrit.
 * En contrepartie, la route ne fait jamais confiance à ce qu'elle reçoit —
 * l'agent est rechargé depuis la base à chaque appel, la consigne système
 * n'est jamais fournie par le client, et le nombre de tours est plafonné.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseAdmin } from '../../../utils/supabaseAdmin';
import { callClaude } from '../../../utils/ai';
import type { Agent, AgentCollectField } from '../../../types/agents';
import { getAnthropicKey } from '../../../services/secrets';
import { emitAutomationEvent } from '../../../services/automationRunner';

export const runtime = 'nodejs';

/** Plafond de contexte : au-delà, la facture grimpe sans gain de qualité. */
const MAX_KNOWLEDGE_CHARS = 24_000;

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  }

  let body: { agentSlug?: string; visitorRef?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const agentSlug = (body.agentSlug ?? '').trim();
  const visitorRef = (body.visitorRef ?? '').trim();
  const message = (body.message ?? '').trim();

  if (!agentSlug || !visitorRef || !message) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message trop long.' }, { status: 400 });
  }

  // ── L'agent est rechargé depuis la base : le client ne décide de rien ────
  const { data: agentRow } = await admin
    .from('agents')
    .select('*')
    .eq('slug', agentSlug)
    .eq('enabled', true)
    .maybeSingle();

  if (!agentRow) {
    return NextResponse.json({ error: 'Agent introuvable.' }, { status: 404 });
  }
  const agent = agentRow as Agent;

  // ── Conversation : reprise si elle existe, création sinon ────────────────
  const { data: existing } = await admin
    .from('agent_conversations')
    .select('*')
    .eq('agent_id', agent.id)
    .eq('visitor_ref', visitorRef)
    .eq('status', 'open')
    .maybeSingle();

  let conversationId = existing?.id as string | undefined;
  if (!conversationId) {
    const { data: created, error } = await admin
      .from('agent_conversations')
      .insert({ agent_id: agent.id, visitor_ref: visitorRef })
      .select('id')
      .single();
    if (error || !created) {
      return NextResponse.json({ error: 'Conversation non créée.' }, { status: 500 });
    }
    conversationId = created.id as string;
  }

  const { data: history } = await admin
    .from('agent_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const turns = (history ?? []).filter((m) => m.role === 'user').length;
  const maxTurnsAllowed = Math.min(15, Math.max(2, agent.max_turns || 10));

  if (turns >= maxTurnsAllowed) {
    const closing =
      "Nous avons fait le tour de ce que je peux traiter ici. Laissez-moi vos coordonnées et notre équipe vous recontacte directement !";
    await admin.from('agent_messages').insert([
      { conversation_id: conversationId, role: 'user', content: message },
      { conversation_id: conversationId, role: 'assistant', content: closing },
    ]);

    await admin
      .from('agent_conversations')
      .update({ status: 'qualified', updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    await emitAutomationEvent('agent.qualified', new URL(req.url).origin);
    return NextResponse.json({ conversationId, reply: closing, limitReached: true });
  }

  // ── Base de connaissances ────────────────────────────────────────────────
  const { data: docs } = await admin
    .from('agent_documents')
    .select('title, content')
    .eq('agent_id', agent.id)
    .limit(60);

  let knowledge = '';
  for (const doc of docs ?? []) {
    const block = `\n## ${doc.title}\n${doc.content}\n`;
    if (knowledge.length + block.length > MAX_KNOWLEDGE_CHARS) break;
    knowledge += block;
  }

  // Option tutoiement / vouvoiement depuis les settings
  const { data: addressModeRow } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'site_address_mode')
    .maybeSingle();

  const isTutoiement = addressModeRow?.value === 'tutoiement';
  const fields = (agent.collect_fields ?? []) as AgentCollectField[];
  const collected = (existing?.collected ?? {}) as Record<string, string>;
  const missing = fields.filter((f) => f.required && !collected[f.key]);
  const turnCount = turns + 1;

  const systemPrompt = [
    agent.system_prompt,
    '',
    "Règles absolues :",
    isTutoiement
      ? "— FORMULE D'ADRESSE : Tu DOIS obligatoirement tutoyer le visiteur (utilise toujours 'tu', 'te', 'ton', 'ta', 'tes')."
      : "— FORMULE D'ADRESSE : Tu DOIS obligatoirement vouvoyer le visiteur (utilise toujours 'vous', 'votre', 'vos').",
    "— Réponds uniquement à partir de la base de connaissances ci-dessous. Si l'information n'y figure pas, dis-le et propose de transmettre la question. N'invente jamais un prix, un délai ou une disponibilité.",
    '— Une seule question à la fois. Réponses courtes, fluides, sans jargon.',
    turnCount === 3 || (turnCount >= 3 && missing.length > 0)
      ? `— RÈGLE D'OR RÉCOLTE DE COORDONNÉES (3ème échange) : Invite poliment et naturellement le visiteur à te fournir ses coordonnées (${missing.map((f) => f.label).join(', ')}) pour donner suite à sa demande.`
      : missing.length
      ? `— Informations à recueillir au fil des échanges : ${missing.map((f) => f.label).join(', ')}.`
      : '— Toutes les informations nécessaires ont été recueillies : propose de conclure.',
    '',
    '# Base de connaissances',
    knowledge || '(vide — dis que tu ne peux pas encore répondre et propose un contact humain)',
  ].join('\n');

  const apiKey = await getAnthropicKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Aucune clé Anthropic configurée.' }, { status: 503 });
  }

  try {
    const completion = await callClaude({
      system: systemPrompt,
      max_tokens: 800,
      feature: 'agent_chat',
      messages: [
        ...(history ?? []).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
        })),
        { role: 'user' as const, content: message },
      ],
    });

    const reply = completion.content.map((block) => block.text).join('\n').trim();

    await admin.from('agent_messages').insert([
      { conversation_id: conversationId, role: 'user', content: message },
      { conversation_id: conversationId, role: 'assistant', content: reply },
    ]);

    await admin
      .from('agent_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({ conversationId, reply });
  } catch (error) {
    console.error('[agent-chat]', error);
    return NextResponse.json(
      { error: (error as Error).message || "L'agent n'a pas pu répondre." },
      { status: 502 },
    );
  }
}
