"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';
import { Mail, Trash2, Download, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, Send } from 'lucide-react';

interface Subscriber { id: string; email: string; created_at: string; active: boolean; welcome_sent?: boolean; welcome_sent_at?: string; }
type SortCol = 'email' | 'date' | 'status';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (sortBy !== col) return <ArrowUpDown size={11} className="text-stone-500" />;
  return sortDir === 'asc' ? <ArrowUp size={11} className="text-sage" /> : <ArrowDown size={11} className="text-sage" />;
}

export default function Subscribers() {
  const [subscribers, setSubscribers]       = useState<Subscriber[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [loadError, setLoadError]           = useState<string | null>(null);
  const [deleting, setDeleting]             = useState<string | null>(null);
  const [sendingWelcome, setSendingWelcome] = useState<string | null>(null);
  const [welcomeResult, setWelcomeResult]   = useState<Record<string, 'ok' | 'err'>>({});
  const [sortBy, setSortBy]                 = useState<SortCol>('date');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setLoadError(null);
    let { data, error } = await supabase.from('subscribers').select('id, email, created_at, active, welcome_sent, welcome_sent_at').order('created_at', { ascending: false }).limit(1000);
    if (error?.message?.includes('welcome_sent')) {
      const fb = await supabase.from('subscribers').select('id, email, created_at, active').order('created_at', { ascending: false }).limit(1000);
      data = (fb.data as typeof data) ?? null; error = fb.error;
    }
    if (error) { console.error(error); setLoadError(error.message); }
    setSubscribers(data || []); setLoading(false);
  };

  const toggleSort = (col: SortCol) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement cet abonné ?')) return;
    setDeleting(id);
    await supabase.from('subscribers').delete().eq('id', id);
    setSubscribers(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
  };

  const sendWelcome = async (sub: Subscriber) => {
    setSendingWelcome(sub.id);
    try {
      const { data: sd } = await supabase.auth.getSession();
      const res = await fetch('/api/welcome-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token || ''}` }, body: JSON.stringify({ email: sub.email }) });
      const data = await res.json();
      setWelcomeResult(prev => ({ ...prev, [sub.id]: data.sent ? 'ok' : 'err' }));
      if (data.sent) setSubscribers(prev => prev.map(s => s.id === sub.id ? { ...s, welcome_sent: true, welcome_sent_at: new Date().toISOString() } : s));
    } catch { setWelcomeResult(prev => ({ ...prev, [sub.id]: 'err' })); }
    finally { setSendingWelcome(null); setTimeout(() => setWelcomeResult(prev => { const n = { ...prev }; delete n[sub.id]; return n; }), 3000); }
  };

  const exportCSV = () => {
    const rows = [['Email','Date inscription','Statut','Bienvenue envoyé','Date envoi bienvenue'], ...sorted.map(s => [s.email, new Date(s.created_at).toLocaleDateString('fr-FR'), s.active ? 'Abonné' : 'Désinscrit', s.welcome_sent ? 'Oui' : 'Non', s.welcome_sent_at ? new Date(s.welcome_sent_at).toLocaleDateString('fr-FR') : ''])];
    const blob = new Blob(['﻿' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `abonnes-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const filtered = subscribers.filter(s => s.email.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'email') cmp = a.email.localeCompare(b.email);
    if (sortBy === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'status') cmp = Number(b.active) - Number(a.active);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const activeCount = subscribers.filter(s => s.active).length;
  const inactiveCount = subscribers.filter(s => !s.active).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-stone-700 mb-1">Audience</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5"><Mail size={20} className="text-sage" /> Abonnés</h1>
          <p className="mt-1 text-sm text-stone-600">
            <span className="text-green-600 font-medium">{activeCount} actif{activeCount !== 1 ? 's' : ''}</span>
            {inactiveCount > 0 && <span className="ml-2 text-stone-500">· {inactiveCount} désinscrit{inactiveCount !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-300 rounded-lg text-sm transition-all cursor-pointer">
            <RefreshCw size={13} /> Actualiser
          </button>
          <button onClick={exportCSV} disabled={sorted.length === 0} className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg text-sm transition-all disabled:opacity-40 cursor-pointer shadow-sm">
            <Download size={13} /> Exporter CSV
          </button>
        </div>
      </div>

      <label htmlFor="subscribers-search" className="sr-only">Rechercher un email</label>
      <input id="subscribers-search" type="text" placeholder="Rechercher un email…" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-3 border border-stone-200 bg-white rounded-xl text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors shadow-sm" />

      <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
        {loadError ? (
          <div className="p-8 text-center"><p className="text-red-500 font-semibold text-sm mb-1">Erreur</p><p className="text-stone-500 text-xs font-mono">{loadError}</p></div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-500 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" /> Chargement…
          </div>
        ) : sorted.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-600">{search ? 'Aucun résultat.' : 'Aucun abonné pour le moment.'}</p>
        ) : (
          <>
            {/* Tableau — écrans sm et plus */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/50">
                    {([['email', 'Email'], ['date', 'Inscription'], ['status', 'Statut']] as [SortCol, string][]).map(([col, lbl]) => (
                      <th key={col} onClick={() => toggleSort(col)}
                        className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-left cursor-pointer hover:text-stone-700 select-none transition-colors">
                        <span className="flex items-center gap-1.5">{lbl} <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} /></span>
                      </th>
                    ))}
                    <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-left">Bienvenue</th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(sub => (
                    <tr key={sub.id} className={`border-b border-stone-50 hover:bg-stone-50/50 transition-colors group ${!sub.active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 font-medium text-stone-900">{sub.email}</td>
                      <td className="px-6 py-4 text-stone-500 text-xs whitespace-nowrap">
                        {new Date(sub.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <SubStatusBadge active={sub.active} />
                      </td>
                      <td className="px-6 py-4">
                        <WelcomeStatus sub={sub} result={welcomeResult[sub.id]} sending={sendingWelcome === sub.id} onSend={() => sendWelcome(sub)} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(sub.id)} disabled={deleting === sub.id}
                          aria-label={`Supprimer l'abonné ${sub.email}`} title="Supprimer"
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 p-1.5 text-stone-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-all disabled:opacity-30 cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes — mobile */}
            <div className="sm:hidden divide-y divide-stone-100">
              {sorted.map(sub => {
                const showSend = !sub.welcome_sent && sub.active && welcomeResult[sub.id] === undefined;
                return (
                  <div key={sub.id} className={`p-4 space-y-3 ${!sub.active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-stone-900 text-sm break-all">{sub.email}</p>
                      <span className="shrink-0"><SubStatusBadge active={sub.active} /></span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[12.5px] text-stone-500">
                      <span>{new Date(sub.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {!showSend && <WelcomeStatus sub={sub} result={welcomeResult[sub.id]} sending={sendingWelcome === sub.id} onSend={() => sendWelcome(sub)} />}
                    </div>
                    <div className={`grid gap-2 pt-1 ${showSend ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {showSend && (
                        <button onClick={() => sendWelcome(sub)} disabled={sendingWelcome === sub.id} aria-label={`Envoyer l'e-mail de bienvenue à ${sub.email}`}
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-sage/30 bg-sage/5 text-sage text-xs font-medium active:bg-sage/10 transition-colors disabled:opacity-40">
                          <Send size={14} /> {sendingWelcome === sub.id ? 'Envoi…' : 'Bienvenue'}
                        </button>
                      )}
                      <button onClick={() => handleDelete(sub.id)} disabled={deleting === sub.id} aria-label={`Supprimer l'abonné ${sub.email}`}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-red-100 text-red-500 text-xs font-medium active:bg-red-50 transition-colors disabled:opacity-40 cursor-pointer">
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SubStatusBadge({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full whitespace-nowrap">● Abonné</span>
    : <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full whitespace-nowrap">● Désinscrit</span>;
}

function WelcomeStatus({ sub, result, sending, onSend }: {
  sub: Subscriber; result: 'ok' | 'err' | undefined; sending: boolean; onSend: () => void;
}) {
  if (result === 'ok') return <span className="text-xs text-green-600 font-semibold whitespace-nowrap">✓ Envoyé</span>;
  if (result === 'err') return <span className="text-xs text-red-500 font-semibold whitespace-nowrap">✗ Erreur</span>;
  if (sub.welcome_sent) return <span className="text-[12.5px] text-stone-500 italic whitespace-nowrap">{sub.welcome_sent_at ? new Date(sub.welcome_sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Déjà envoyé'}</span>;
  return (
    <button onClick={onSend} disabled={sending || !sub.active}
      className="flex items-center gap-1.5 text-xs text-sage hover:text-stone-900/70 font-semibold transition-colors disabled:opacity-30 cursor-pointer whitespace-nowrap">
      <Send size={11} />{sending ? '…' : 'Envoyer'}
    </button>
  );
}
