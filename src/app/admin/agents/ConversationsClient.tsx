'use client';

import React, { useEffect, useState } from 'react';
import { MessagesSquare, User, Bot } from 'lucide-react';

import { Card, CardBody, CardHeader, EmptyState, Spinner } from '../../../components/admin/ui';

import { fetchAgents, fetchConversations, fetchMessages } from '../../../services/agents';
import type { Agent, AgentConversation, AgentMessage } from '../../../types/agents';

const STATUS_LABEL: Record<AgentConversation['status'], string> = {
  open: 'En cours',
  qualified: 'Qualifiée',
  closed: 'Close',
};

export default function ConversationsClient() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [selected, setSelected] = useState<AgentConversation | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [agentRows, rows] = await Promise.all([fetchAgents(), fetchConversations()]);
        setAgents(agentRows);
        setConversations(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    // Ignore la réponse d'une conversation quittée entre-temps : sans ce
    // garde-fou, un clic rapide affichait les messages de la précédente.
    let cancelled = false;
    setLoadingMessages(true);
    void fetchMessages(selected.id)
      .then((rows) => { if (!cancelled) setMessages(rows); })
      .catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Agent supprimé';

  if (loading) return <Spinner label="Chargement des conversations…" />;

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="Aucune conversation"
        description="Les échanges apparaîtront ici dès qu’un visiteur écrira à un agent — ou dès votre premier essai depuis l’onglet Agents."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <Card className="overflow-hidden">
        <CardHeader title={`${conversations.length} conversation${conversations.length > 1 ? 's' : ''}`} />
        <ul className="max-h-[32rem] divide-y divide-stone-200 overflow-y-auto">
          {conversations.map((conversation) => {
            const isSelected = selected?.id === conversation.id;
            const collected = Object.entries(conversation.collected ?? {});
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => setSelected(conversation)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full px-5 py-3.5 text-left transition-colors cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900 ${
                      isSelected ? 'bg-accent-soft' : 'hover:bg-stone-50'
                    }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-stone-900">
                      {agentName(conversation.agent_id)}
                    </span>
                    <span className="shrink-0 text-[13px] text-stone-700">
                      {STATUS_LABEL[conversation.status]}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[13px] tabular-nums text-stone-600">
                    {new Date(conversation.created_at).toLocaleString('fr-CH')}
                  </span>
                  {collected.length > 0 && (
                    <span className="mt-1 block truncate text-[13px] text-stone-700">
                      {collected.map(([key, value]) => `${key} : ${value}`).join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {selected ? (
        <Card className="min-w-0">
          <CardHeader
            title={agentName(selected.agent_id)}
            description={`Visiteur ${selected.visitor_ref.slice(0, 12)}${selected.visitor_ref.startsWith('apercu-admin') ? ' — essai depuis l’administration' : ''}`}
          />
          <CardBody>
            {loadingMessages ? (
              <Spinner label="Chargement de l’échange…" />
            ) : messages.length === 0 ? (
              <p className="text-[14px] text-stone-600">Aucun message dans cette conversation.</p>
            ) : (
            <ul className="max-h-[28rem] space-y-3 overflow-y-auto">
              {messages.map((message) => (
                <li key={message.id} className="flex gap-2.5">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-md ${
                      message.role === 'user' ? 'bg-stone-100 text-stone-700' : 'bg-accent text-accent-fg'
                    }`}
                  >
                    {message.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                  </span>
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-stone-800">
                    {message.content}
                  </p>
                </li>
              ))}
            </ul>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon={MessagesSquare}
              title="Sélectionnez une conversation"
              description="Vous verrez l’échange complet, et ce que l’agent a réussi à recueillir."
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
