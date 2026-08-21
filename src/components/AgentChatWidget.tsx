'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, X } from 'lucide-react';

/**
 * Widget public de conversation avec un agent IA.
 *
 * La route `/api/agent-chat` existait déjà — complète, protégée, journalisée —
 * mais aucune interface ne l'appelait : les tables `agent_conversations` et
 * `agent_messages` ne pouvaient donc jamais se remplir, et l'écran
 * « Conversations » de l'admin restait vide par construction.
 *
 * Le visiteur est identifié par une référence tirée au sort et conservée dans
 * `localStorage` : pas de compte, pas de cookie de suivi, et la conversation
 * se retrouve si la personne revient depuis le même navigateur.
 */

const VISITOR_KEY = 'agent_visitor_ref';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function readVisitorRef(): string {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const ref =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(VISITOR_KEY, ref);
  return ref;
}

export default function AgentChatWidget({
  slug,
  name,
  greeting,
  avatar,
}: {
  slug: string;
  name: string;
  greeting: string;
  avatar?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && messages.length === 0 && greeting) {
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [open, greeting, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || closed) return;

    setDraft('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);

    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentSlug: slug,
          visitorRef: readVisitorRef(),
          message: text,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || 'Une erreur est survenue.');
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.limitReached) setClosed(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Discuter avec ${name}`}
        className="fixed bottom-6 right-6 z-[9998] flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3.5 text-sm font-bold text-white shadow-xl transition-transform hover:scale-[1.03] cursor-pointer"
      >
        <span className="text-xl">{avatar || '🤖'}</span>
        <span className="hidden sm:inline">Une question ?</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={`Conversation avec ${name}`}
      className="fixed bottom-6 right-6 z-[9998] flex h-[32rem] max-h-[calc(100vh-3rem)] w-[min(24rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold text-stone-900">
          <span className="text-lg">{avatar || '🤖'}</span> {name}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer la conversation"
          className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              message.role === 'user'
                ? 'ml-auto bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-800'
            }`}
          >
            {message.content}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-stone-400">
            <Loader2 size={13} className="animate-spin" /> {name} rédige…
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-stone-100 p-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy || closed}
          maxLength={2000}
          placeholder={closed ? 'Conversation terminée' : 'Votre message…'}
          aria-label="Votre message"
          className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-stone-400 focus:bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || closed || !draft.trim()}
          aria-label="Envoyer"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-900 text-white transition-opacity disabled:opacity-40 cursor-pointer"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
